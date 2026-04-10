# MadamYen Admin (Next.js + Supabase)

## Setup

1) Create `.env.local`
- Copy `.env.example` → `.env.local`

2) Install + run
- `npm install`
- `npm run dev`

Open:
- `http://localhost:3000/login`

## Pages

- `/admin/raw` export raw JSON + import lên Supabase
- `/admin/report` xem report (đọc từ Supabase)

## Auto sync 1AM (Vercel)

Repo đã có `vercel.json` để Vercel Cron gọi:
- `POST /api/cron/sync-yesterday`
- Header: `x-cron-secret: <CRON_SECRET>`

Lưu ý: Vercel cron schedule dùng UTC. Hiện đang set `0 13 * * *` (01:00 Pacific/Auckland khi NZST/UTC+12). Nếu vào NZDT (UTC+13) thì đổi sang `0 12 * * *`.

