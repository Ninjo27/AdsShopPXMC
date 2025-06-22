const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(process.env.https://ibylievcmlzzyzkihzfo.supabase.co, process.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieWxpZXZjbWx6enl6a2loemZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3OTQ4OTYsImV4cCI6MjA2NTM3MDg5Nn0.iJNGvjly4q5M43Xd5uJ8A0OZT7PSrbQWcuhas9WWEiM);
const ADSTERRA_API_TOKEN = process.env.d41758802c69fc5af28bec3c6f3ea4bd;

async function updateStatus() {
  // 1. Lấy các adsterra_id đang pending
  const { data: pendingRows } = await supabase
    .from('ad_click_logs')
    .select('id, user_id, adsterra_id')
    .eq('status', 'pending');
  if (!pendingRows || pendingRows.length === 0) return;

  // Gom nhóm theo adsterra_id
  const adsterraIdMap = {};
  pendingRows.forEach(row => {
    if (!adsterraIdMap[row.adsterra_id]) adsterraIdMap[row.adsterra_id] = [];
    adsterraIdMap[row.adsterra_id].push(row);
  });

  // Lấy thống kê từ Adsterra
  const date = new Date().toISOString().slice(0, 10);
  const resp = await fetch(
    `https://partner.adsterra.com/api/v2/statistics?date_from=${date}&date_to=${date}&group_by=subid`,
    { headers: { "Api-Token": ADSTERRA_API_TOKEN } }
  );
  const stats = await resp.json();

  for (const [adsterra_id, rows] of Object.entries(adsterraIdMap)) {
    const stat = stats.data?.find(item => item.subid === adsterra_id);
    const conversionCount = stat ? Number(stat.conversions) : 0;

    // Đếm số row đã success cho adsterra_id này
    const { count: successCount } = await supabase
      .from('ad_click_logs')
      .select('*', { count: 'exact', head: true })
      .eq('adsterra_id', adsterra_id)
      .eq('status', 'success');

    const needUpdate = Math.max(0, conversionCount - (successCount || 0));
    if (needUpdate > 0) {
      const rowsToUpdate = rows.slice(0, needUpdate);

      for (const row of rowsToUpdate) {
        // Cập nhật status
        await supabase
          .from('ad_click_logs')
          .update({ status: 'success' })
          .eq('id', row.id);

        // Cộng xu cho user
        const { data: user } = await supabase.from('users').select('*').eq('id', row.user_id).maybeSingle();
        if (user) {
          await supabase.from('users').update({ balance: user.balance + 1 }).eq('id', row.user_id);
        }
      }
    }
  }
}

updateStatus();
