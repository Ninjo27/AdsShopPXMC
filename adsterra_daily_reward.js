name: Adsterra Auto Reward

on:
  schedule:
    - cron: '5 0 * * *' # Chạy lúc 0h05 UTC mỗi ngày
  workflow_dispatch:

jobs:
  run-script:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm install
      - name: Run Adsterra Reward Script
        env:
          ADSTERRA_API_KEY: ${{ secrets.ADSTERRA_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: node adsterra_daily_reward.js
