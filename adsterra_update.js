const fetch = require('node-fetch');

// === Sửa các thông tin này theo dự án của bạn ===
const ADSTERRA_API_KEY = 'e90ff5b14479f75c9e05d87a5c46136b';
const SUPABASE_URL = 'https://ibylievcmlzzyzkihzfo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieWxpZXZjbWx6enl6a2loemZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3OTQ4OTYsImV4cCI6MjA2NTM3MDg5Nn0.iJNGvjly4q5M43Xd5uJ8A0OZT7PSrbQWcuhas9WWEiM'; // Nên dùng service_role

// Lấy ngày hôm qua ở múi giờ UTC (Adsterra dùng UTC)
function getYesterday() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  return yesterday.toISOString().slice(0, 10); // yyyy-mm-dd
}

async function getAdsterraStatsByDay(date) {
  const url = `https://api3.adsterra.com/v1/statistics?start_date=${date}&end_date=${date}&campaign_type=directlink`;
  const res = await fetch(url, { headers: { 'X-API-KEY': ADSTERRA_API_KEY } });
  const data = await res.json();
  return Array.isArray(data.rows) ? data.rows : [];
}

async function getUserLinkByAdsterraId(adsterra_id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/adsterra_links?adsterra_id=eq.${adsterra_id}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const arr = await res.json();
  return arr.length ? arr[0] : null;
}

async function updateUserCoin(username, add_xu) {
  // Cộng xu cho user trong bảng users
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ balance: { "+": add_xu } })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lỗi cộng xu cho user ${username}: ${err}`);
  }
}

async function updateAdsterraLinkLog(row_id, last_update, last_views) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/adsterra_links?id=eq.${row_id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ last_update, last_views })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lỗi cập nhật log cho row ${row_id}: ${err}`);
  }
}

async function main() {
  const date = getYesterday();
  console.log(`--- BẮT ĐẦU cộng xu cho ngày: ${date} ---`);
  const stats = await getAdsterraStatsByDay(date);

  for (let row of stats) {
    const adsterra_id = row.id;
    const views = row.views || 0;

    const userLink = await getUserLinkByAdsterraId(adsterra_id);
    if (!userLink) {
      console.log(`Không tìm thấy mapping user cho link Adsterra ${adsterra_id}`);
      continue;
    }

    if (userLink.last_update === date) {
      console.log(`Đã cộng xu cho user ${userLink.username} hôm nay rồi.`);
      continue;
    }

    const last_views = userLink.last_views || 0;
    const add_xu = Math.max(views - last_views, 0);

    if (add_xu > 0) {
      try {
        await updateUserCoin(userLink.username, add_xu);
        await updateAdsterraLinkLog(userLink.id, date, views);
        console.log(`Cộng ${add_xu} xu cho user ${userLink.username} (link ${adsterra_id})`);
      } catch (err) {
        console.log(`Lỗi khi cộng xu cho user ${userLink.username}: ${err.message}`);
      }
    } else {
      await updateAdsterraLinkLog(userLink.id, date, views);
      console.log(`Không có view mới cho user ${userLink.username} (link ${adsterra_id})`);
    }
  }
  console.log('--- HOÀN TẤT cộng xu ---');
}

main().catch(err => console.error('Lỗi tổng:', err));
