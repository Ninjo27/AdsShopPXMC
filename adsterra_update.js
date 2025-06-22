const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Gắn trực tiếp các giá trị tạm thời vào đây:
const SUPABASE_URL = 'https://ibylievcmlzzyzkihzfo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieWxpZXZjbWx6enl6a2loemZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3OTQ4OTYsImV4cCI6MjA2NTM3MDg5Nn0.iJNGvjly4q5M43Xd5uJ8A0OZT7PSrbQWcuhas9WWEiM'; // ← Thay bằng key đầy đủ của anh
const ADSTERRA_API_TOKEN = 'd41758802c69fc5af28bec3c6f3ea4bd';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function updateStatus() {
  console.log("🚀 Bắt đầu chạy script cập nhật xu");

  const { data: pendingRows, error: pendingError } = await supabase
    .from('ad_click_logs')
    .select('id, user_id, adsterra_id')
    .eq('status', 'pending');

  if (pendingError) {
    console.error('❌ Lỗi khi lấy dữ liệu pending:', pendingError);
    return;
  }

  console.log("📌 Số dòng pending lấy được:", pendingRows?.length || 0);

  if (!pendingRows || pendingRows.length === 0) {
    console.log('⏹ Không có dòng nào đang pending.');
    return;
  }

  const adsterraIdMap = {};
  pendingRows.forEach(row => {
    if (!adsterraIdMap[row.adsterra_id]) adsterraIdMap[row.adsterra_id] = [];
    adsterraIdMap[row.adsterra_id].push(row);
  });

  const date = new Date().toISOString().slice(0, 10);
  console.log(`📅 Đang lấy số liệu từ Adsterra cho ngày ${date}...`);

  const resp = await fetch(
    `https://partner.adsterra.com/api/v2/statistics?date_from=${date}&date_to=${date}&group_by=subid`,
    { headers: { 'Api-Token': ADSTERRA_API_TOKEN } }
  );

  const stats = await resp.json();
  console.log("📦 Dữ liệu Adsterra:", stats.data);

  if (!Array.isArray(stats.data)) {
    console.error('❌ Dữ liệu Adsterra trả về không hợp lệ:', stats);
    return;
  }

  for (const [adsterra_id, rows] of Object.entries(adsterraIdMap)) {
    const stat = stats.data.find(item => item.subid === adsterra_id);
    const conversionCount = stat ? Number(stat.conversions) : 0;

    const { count: successCount, error: countError } = await supabase
      .from('ad_click_logs')
      .select('*', { count: 'exact', head: true })
      .eq('adsterra_id', adsterra_id)
      .eq('status', 'success');

    if (countError) {
      console.error('❌ Lỗi khi đếm success:', countError);
      continue;
    }

    const needUpdate = Math.max(0, conversionCount - (successCount || 0));
    console.log(`📊 Link ${adsterra_id}: conversions=${conversionCount}, successes=${successCount}, cần update ${needUpdate} dòng`);

    if (needUpdate > 0) {
      const rowsToUpdate = rows.slice(0, needUpdate);
      for (const row of rowsToUpdate) {
        const { error: updateError } = await supabase
          .from('ad_click_logs')
          .update({ status: 'success' })
          .eq('id', row.id);

        if (updateError) {
          console.error(`❌ Lỗi khi cập nhật status cho dòng ${row.id}:`, updateError);
          continue;
        }

        const { data: user, error: userError } = await supabase
          .from('users')
          .select('balance')
          .eq('id', row.user_id)
          .maybeSingle();

        if (userError || !user) {
          console.error(`❌ Không tìm thấy user ${row.user_id}:`, userError);
          continue;
        }

        const { error: balanceError } = await supabase
          .from('users')
          .update({ balance: user.balance + 1 })
          .eq('id', row.user_id);

        if (balanceError) {
          console.error(`❌ Lỗi khi cộng xu cho user ${row.user_id}:`, balanceError);
        } else {
          console.log(`✅ Đã cộng 1 xu cho user ${row.user_id}`);
        }
      }
    }
  }
}

updateStatus().catch(err => {
  console.error("💥 Lỗi không mong muốn:", err);
});
