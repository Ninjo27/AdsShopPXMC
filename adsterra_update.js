const fetch = require('node-fetch');

// === Sửa các thông tin này theo dự án của bạn ===
const ADSTERRA_API_KEY = 'e90ff5b14479f75c9e05d87a5c46136b';
const SUPABASE_URL = 'https://ibylievcmlzzyzkihzfo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieWxpZXZjbWx6enl6a2loemZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3OTQ4OTYsImV4cCI6MjA2NTM3MDg5Nn0.iJNGvjly4q5M43Xd5uJ8A0OZT7PSrbQWcuhas9WWEiM'; // Nên dùng service_role

async function getPendingLogs() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ad_click_logs?status=eq.pending`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  return await res.json();
}

async function getAdsterraStatsByDay(date) {
  const url = `https://api3.adsterra.com/v1/statistics?start_date=${date}&end_date=${date}&campaign_type=directlink`;
  const res = await fetch(url, { headers: { 'X-API-KEY': ADSTERRA_API_KEY } });
  const data = await res.json();
  return Array.isArray(data.rows) ? data.rows : [];
}

async function confirmClick(logId) {
  // Update log status to confirmed
  await fetch(`${SUPABASE_URL}/rest/v1/ad_click_logs?id=eq.${logId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'confirmed' })
  });
}

async function updateUserCoin(username, add_xu) {
  await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ balance: { "+": add_xu } })
  });
}

async function main() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const stats = await getAdsterraStatsByDay(date);

  // Map adsterra_id -> views
  const viewMap = {};
  for (const row of stats) {
    viewMap[row.id] = row.views || 0;
  }

  const logs = await getPendingLogs();

  for (const log of logs) {
    // Với mỗi log, kiểm tra adsterra_id đã có view mới hay chưa
    const adsterra_id = log.adsterra_id;
    const views = viewMap[adsterra_id] || 0;

    // Đếm số log confirmed của adsterra_id hôm nay
    // (Bạn cần lấy số log đã xác nhận trước đó, ở đây giả sử mỗi log là 1 click)
    // Cách đơn giản: chỉ xác nhận click mới nếu tổng số log confirmed < tổng views Adsterra
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ad_click_logs?adsterra_id=eq.${adsterra_id}&status=eq.confirmed&created_at=gte.${date}T00:00:00`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const confirmedLogs = await res.json();
    if (confirmedLogs.length < views) {
      // Đủ điều kiện xác nhận
      await confirmClick(log.id);
      await updateUserCoin(log.username, 1);
      console.log(`Cộng 1 xu cho ${log.username} (adsterra_id ${adsterra_id}), xác nhận log ${log.id}`);
    } else {
      // Chưa xác nhận được (view bên Adsterra chưa tăng)
      console.log(`Chưa xác nhận được log ${log.id} cho ${log.username}`);
    }
  }
}

main().catch(console.error);
