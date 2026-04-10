# MadamYen Admin (Next.js + Supabase)

Project này đã được dọn lại để chỉ còn **Next.js admin** phục vụ:
- Export raw `SaleHistory` theo khoảng thời gian (có phân trang / all).
- Import (upload) raw JSON lên **Supabase**.
- Trang **report** đọc dữ liệu từ Supabase để vẽ biểu đồ/báo cáo.

## Dev

1) Vào app:
- `cd next-admin`

2) Tạo `.env.local`
- Copy `next-admin/.env.example` → `next-admin/.env.local`

3) Chạy:
- `npm install`
- `npm run dev`

Open `http://localhost:3000/login`
