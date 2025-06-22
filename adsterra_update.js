const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const ADSTERRA_API_TOKEN = process.env.ADSTERRA_API_TOKEN;

async function updateStatus() {
  // 1. Lấy các adsterra_id đang pending
  const { data: pendingRows, error: pendingError } = await supabase
    .from('ad_click_logs')
    .select('id, user_id, adsterra_id')
    .eq('status', 'pending');

  if (pendingError) {
    console.error('Lỗi khi lấy dữ liệu pending:', pendingError);
    return;
  }
  if (!pendingRows || pendingRows.length === 0) {
    console.log('Không có dòng nào đang pending.');
    return;
  }

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
    { headers: { 'Api-Token': ADSTERRA_API_TOKEN } }
  );
  const stats = await resp.json();
console.log("📦 Thống kê Adsterra:", stats.data);

  if (!Array.isArray(stats.data)) {
    console.error('Dữ liệu Adsterra trả về không hợp lệ:', stats);
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
      console.error('Lỗi khi đếm số success:', countError);
      continue;
    }

    const needUpdate = Math.max(0, conversionCount - (successCount || 0));
    console.log(`Adsterra ID ${adsterra_id}: conversions=${conversionCount}, successes=${successCount}, cần update ${needUpdate} dòng.`);

    if (needUpdate > 0) {
      const rowsToUpdate = rows.slice(0, needUpdate);
      for (const row of rowsToUpdate) {
        const { error: updateError } = await supabase
          .from('ad_click_logs')
          .update({ status: 'success' })
          .eq('id', row.id);

        if (updateError) {
          console.error(`Lỗi khi cập nhật status cho row ${row.id}:`, updateError);
          continue;
        }
console.log("🚀 Bắt đầu chạy script cập nhật xu");
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('balance')
          .eq('id', row.user_id)
          .maybeSingle();
console.log("📌 Dòng pending lấy được:", pendingRows?.length);

        if (userError || !user) {
          console.error(`Không tìm thấy user hoặc lỗi user ${row.user_id}:`, userError);
          continue;
        }

        const { error: balanceError } = await supabase
          .from('users')
          .update({ balance: user.balance + 1 })
          .eq('id', row.user_id);

        if (balanceError) {
          console.error(`Lỗi khi cộng xu cho user ${row.user_id}:`, balanceError);
        } else {
          console.log(`✅ Cập nhật thành công cho user ${row.user_id}`);
        }
      }
    }
  }
}

updateStatus();
