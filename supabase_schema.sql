-- Normalized schema for SaleHistory raw export
-- Tables:
-- - sales_orders: 1 row per order
-- - sales_order_items: 1 row per product line
-- - sales_transactions: 1 row per payment transaction

create table if not exists public.sales_orders (
  id bigint primary key,
  provider text not null default 'madamyen',

  created_at timestamptz null,
  last_updated_at timestamptz null,

  station_id int null,
  station text null,
  user_id int null,
  staff text null,

  table_id int null,
  table_name text null,

  order_status int null,
  daily_id int null,
  invoice_number text null,

  is_take_away boolean null,
  is_dinein boolean null,
  voided boolean null,

  total_paid numeric null,
  total_gst numeric null,
  total_amount_after_adjustment numeric null,
  total_amount_before_adjustment numeric null,
  total_to_pay numeric null,

  raw_json jsonb not null,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_orders_created_at on public.sales_orders (created_at);
create index if not exists idx_sales_orders_staff on public.sales_orders (staff);
create index if not exists idx_sales_orders_voided on public.sales_orders (voided);
create index if not exists idx_sales_orders_voided_created_at on public.sales_orders (voided, created_at);

create table if not exists public.sales_order_items (
  line_id bigint primary key,
  order_id bigint not null references public.sales_orders(id) on delete cascade,
  provider text not null default 'madamyen',

  created_at timestamptz null,

  product_id int null,
  name text null,
  quantity numeric null,
  sell_price numeric null,
  total_amount numeric null,

  variant_id int null,
  variant_name text null,

  raw_json jsonb not null,
  inserted_at timestamptz not null default now()
);

create index if not exists idx_sales_order_items_order_id on public.sales_order_items (order_id);
create index if not exists idx_sales_order_items_product_id on public.sales_order_items (product_id);
create index if not exists idx_sales_order_items_name on public.sales_order_items (name);

create table if not exists public.sales_transactions (
  id bigint primary key,
  order_id bigint not null references public.sales_orders(id) on delete cascade,
  provider text not null default 'madamyen',

  created_at timestamptz null,

  payment_type int null,
  payment_type_name text null,
  total_amount numeric null,
  received numeric null,
  rounding numeric null,

  raw_json jsonb not null,
  inserted_at timestamptz not null default now()
);

create index if not exists idx_sales_transactions_order_id on public.sales_transactions (order_id);
create index if not exists idx_sales_transactions_created_at on public.sales_transactions (created_at);

-- Optional: auto-update updated_at on upsert updates
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sales_orders_updated_at on public.sales_orders;
create trigger trg_sales_orders_updated_at
before update on public.sales_orders
for each row execute function public.set_updated_at();
