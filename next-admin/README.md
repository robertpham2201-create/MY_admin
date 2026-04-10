# Next.js Admin (Raw export + Supabase report)

## Setup

1) Create `.env.local`
- Copy `.env.example` → `.env.local`
- Fill:
  - `ADMIN_API_KEY` (password login của admin UI)
  - `MADAMYEN_*` (để export raw SaleHistory từ website)
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (để import & query report)

2) Run locally
- `npm install`
- `npm run dev`

## Pages

- `GET /login` đăng nhập (dùng `ADMIN_API_KEY`)
- `GET /admin/raw` export raw JSON + import lên Supabase
- `GET /admin/report` xem report (đọc từ Supabase)

## Auto sync 1AM (deploy)

Khuyến nghị deploy lên Vercel và dùng Vercel Cron gọi endpoint:
- `POST /api/cron/sync-yesterday`
- Header: `x-cron-secret: <CRON_SECRET>`

Lưu ý: Vercel Cron schedule dùng **UTC**. Repo đã set `next-admin/vercel.json` chạy `0 13 * * *` (tương ứng **01:00 Pacific/Auckland** khi đang NZST/UTC+12). Nếu vào mùa NZDT (UTC+13) thì cần đổi sang `0 12 * * *`.
