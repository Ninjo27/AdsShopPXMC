import os, requests

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']
ADSTERRA_TOKEN = os.environ['ADSTERRA_TOKEN']

headers_supabase = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json'
}

# 1. Gọi Adsterra API
r = requests.get(
    "https://partner.adsterra.com/api/v2/statistics",
    headers={ "Api-Token": ADSTERRA_TOKEN },
    params={ "group_by": "zone_id", "date_from": "today", "date_to": "today" }
)
stats = r.json()

for stat in stats:
    zone_id = stat['zone_id']
    conversions = stat['conversions']
    if conversions == 0:
        continue

    # 2. Đếm số dòng 'success'
    r1 = requests.get(
        f"https://{SUPABASE_URL}/rest/v1/ad_click_logs?adsterra_id=eq.{zone_id}&status=eq.success&select=id",
        headers=headers_supabase
    )
    done = len(r1.json())
    need = conversions - done
    if need <= 0:
        continue

    print(f"▶️ Zone {zone_id} cần cộng thêm {need} lần...")

    # 3. Lấy các dòng 'pending'
    r2 = requests.get(
        f"https://{SUPABASE_URL}/rest/v1/ad_click_logs?adsterra_id=eq.{zone_id}&status=eq.pending&limit={need}&select=*",
        headers=headers_supabase
    )
    logs = r2.json()

    for log in logs:
        uid = log["user_id"]
        log_id = log["id"]

        # 4. Đổi status = success
        requests.patch(
            f"https://{SUPABASE_URL}/rest/v1/ad_click_logs?id=eq.{log_id}",
            headers=headers_supabase,
            json={ "status": "success" }
        )

        # 5. Cộng xu cho user
        r3 = requests.get(
            f"https://{SUPABASE_URL}/rest/v1/users?user_id=eq.{uid}&select=balance",
            headers=headers_supabase
        )
        balance = r3.json()[0]['balance'] or 0

        requests.patch(
            f"https://{SUPABASE_URL}/rest/v1/users?user_id=eq.{uid}",
            headers=headers_supabase,
            json={ "balance": balance + 1 }
        )

        print(f"✅ +1 xu cho {uid} (zone {zone_id})")
