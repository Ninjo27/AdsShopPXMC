const fetch = require('node-fetch');

const ADSTERRA_API_KEY = 'e90ff5b14479f75c9e05d87a5c46136b';
const SUPABASE_URL = 'https://ibylievcmlzzyzkihzfo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieWxpZXZjbWx6enl6a2loemZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3OTQ4OTYsImV4cCI6MjA2NTM3MDg5Nn0.iJNGvjly4q5M43Xd5uJ8A0OZT7PSrbQWcuhas9WWEiM'; // Dùng service key cho tác vụ backend

const date = '2025-06-20'; // Bạn có thể để thành biến động theo ngày hiện tại

async function getAdsterraStatsByDay(date) {
  const url = `https://api3.adsterra.com/v1/statistics?start_date=${date}&end_date=${date}&campaign_type=directlink`;
  const res = await fetch(url, { headers: { 'X-API-KEY': ADSTERRA_API_KEY } });
  const data = await res.json();
  return data.rows; // [{ id, views, ... }]
}

async function getUserByAdsterraId(adsterra_id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/adsterra_links?adsterra_id=eq.${adsterra_id}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const users = await res.json();
  return users.length ? users[0] : null;
}

async function updateUserCoin(username, add_xu) {
  // Cộng xu cho user trong bảng users
  await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ balance: { "+": add_xu } })
  });
}

async function updateAdsterraLinkLog(row_id, last_updated, last_views) {
  await fetch(`${SUPABASE_URL}/rest/v1/adsterra_links?id=eq.${row_id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ last_updated, last_views })
  });
}

async function main() {
  const stats = await getAdsterraStatsByDay(date);
  for (let row of stats) {
    const adsterra_id = row.id;
    const views = row.views || 0;

    const userLink = await getUserByAdsterraId(adsterra_id);
    if (!userLink) continue;

    // Nếu last_updated khác ngày đang xử lý, mới cộng xu
    if (userLink.last_updated !== date) {
      const add_xu = views; // mỗi view = 1 xu
      await updateUserCoin(userLink.username, add_xu);

      // Ghi log lại đã cộng xu cho ngày này
      await updateAdsterraLinkLog(userLink.id, date, views);

      console.log(`Cộng ${add_xu} xu cho user ${userLink.username} (link ${adsterra_id})`);
    } else {
      console.log(`Đã cộng xu cho ${userLink.username} hôm nay rồi.`);
    }
  }
}

main();
