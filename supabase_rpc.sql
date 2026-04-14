-- RPC to upsert a single SaleHistory order (and its lines/transactions) atomically.
-- Call from client:
--   select public.upsert_salehistory_order('<json>'::jsonb);
--
-- Notes:
-- - Runs in a single transaction per call (Postgres function execution is atomic).
-- - Expects fields similar to madamyen SaleHistory item:
--   Id, CreateOn, LastUpdatedOn, StationId, Station, UserId, Staff, TableId, TableName,
--   OrderStatus, DailyId, InoviceNumber, IsTakeAway, IsDinein, Voided, TotalPaid, TotalGst,
--   TotalAmountAfterAdjustment, TotalAmountBeforeAdjustment, TotalToPay,
--   Products: [{ Product: {...} }], Transactions: [{...}]

create or replace function public.upsert_salehistory_order(p_provider text, p_order jsonb)
returns void
language plpgsql
as $$
declare
  v_order_id bigint;
  v_line jsonb;
  v_prod jsonb;
  v_txn jsonb;
begin
  v_order_id := nullif((p_order->>'Id')::bigint, 0);
  if v_order_id is null then
    raise exception 'Missing order Id';
  end if;

  insert into public.sales_orders (
    id,
    provider,
    created_at,
    last_updated_at,
    station_id,
    station,
    user_id,
    staff,
    table_id,
    table_name,
    order_status,
    daily_id,
    invoice_number,
    is_take_away,
    is_dinein,
    voided,
    total_paid,
    total_gst,
    total_amount_after_adjustment,
    total_amount_before_adjustment,
    total_to_pay,
    raw_json
  )
  values (
    v_order_id,
    p_provider,
    nullif(p_order->>'created_at', '')::timestamptz,
    nullif(p_order->>'last_updated_at', '')::timestamptz,
    (p_order->>'StationId')::int,
    p_order->>'Station',
    (p_order->>'UserId')::int,
    p_order->>'Staff',
    (p_order->>'TableId')::int,
    p_order->>'TableName',
    (p_order->>'OrderStatus')::int,
    (p_order->>'DailyId')::int,
    p_order->>'InoviceNumber',
    (p_order->>'IsTakeAway')::boolean,
    (p_order->>'IsDinein')::boolean,
    (p_order->>'Voided')::boolean,
    (p_order->>'TotalPaid')::numeric,
    (p_order->>'TotalGst')::numeric,
    (p_order->>'TotalAmountAfterAdjustment')::numeric,
    (p_order->>'TotalAmountBeforeAdjustment')::numeric,
    (p_order->>'TotalToPay')::numeric,
    p_order
  )
  on conflict (id) do update set
    provider = excluded.provider,
    created_at = excluded.created_at,
    last_updated_at = excluded.last_updated_at,
    station_id = excluded.station_id,
    station = excluded.station,
    user_id = excluded.user_id,
    staff = excluded.staff,
    table_id = excluded.table_id,
    table_name = excluded.table_name,
    order_status = excluded.order_status,
    daily_id = excluded.daily_id,
    invoice_number = excluded.invoice_number,
    is_take_away = excluded.is_take_away,
    is_dinein = excluded.is_dinein,
    voided = excluded.voided,
    total_paid = excluded.total_paid,
    total_gst = excluded.total_gst,
    total_amount_after_adjustment = excluded.total_amount_after_adjustment,
    total_amount_before_adjustment = excluded.total_amount_before_adjustment,
    total_to_pay = excluded.total_to_pay,
    raw_json = excluded.raw_json;

  -- Product lines
  if jsonb_typeof(p_order->'Products') = 'array' then
    for v_line in select * from jsonb_array_elements(p_order->'Products')
    loop
      v_prod := v_line->'Product';
      if v_prod is null then
        continue;
      end if;

      insert into public.sales_order_items (
        line_id,
        order_id,
        provider,
        created_at,
        product_id,
        name,
        quantity,
        sell_price,
        total_amount,
        variant_id,
        variant_name,
        raw_json
      )
      values (
        (v_prod->>'Id')::bigint,
        v_order_id,
        p_provider,
        nullif(v_prod->>'created_at', '')::timestamptz,
        (v_prod->>'ProductId')::int,
        v_prod->>'name',
        (v_prod->>'Quantity')::numeric,
        (v_prod->>'SellPrice')::numeric,
        (v_prod->>'TotalAmount')::numeric,
        (v_prod->>'VariantId')::int,
        v_prod->>'VariantName',
        v_line
      )
      on conflict (line_id) do update set
        order_id = excluded.order_id,
        provider = excluded.provider,
        created_at = excluded.created_at,
        product_id = excluded.product_id,
        name = excluded.name,
        quantity = excluded.quantity,
        sell_price = excluded.sell_price,
        total_amount = excluded.total_amount,
        variant_id = excluded.variant_id,
        variant_name = excluded.variant_name,
        raw_json = excluded.raw_json;
    end loop;
  end if;

  -- Transactions
  if jsonb_typeof(p_order->'Transactions') = 'array' then
    for v_txn in select * from jsonb_array_elements(p_order->'Transactions')
    loop
      insert into public.sales_transactions (
        id,
        order_id,
        provider,
        created_at,
        payment_type,
        payment_type_name,
        total_amount,
        received,
        rounding,
        raw_json
      )
      values (
        (v_txn->>'Id')::bigint,
        v_order_id,
        p_provider,
        nullif(v_txn->>'created_at', '')::timestamptz,
        (v_txn->>'PaymentType')::int,
        v_txn->>'PaymentTypeName',
        (v_txn->>'TotalAmount')::numeric,
        (v_txn->>'Received')::numeric,
        (v_txn->>'Rounding')::numeric,
        v_txn
      )
      on conflict (id) do update set
        order_id = excluded.order_id,
        provider = excluded.provider,
        created_at = excluded.created_at,
        payment_type = excluded.payment_type,
        payment_type_name = excluded.payment_type_name,
        total_amount = excluded.total_amount,
        received = excluded.received,
        rounding = excluded.rounding,
        raw_json = excluded.raw_json;
    end loop;
  end if;
end;
$$;

create or replace function public.is_main_category_item(p_name text, p_variant_name text default null)
returns boolean
language sql
immutable
as $$
  with normalized as (
    select
      lower(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'))) as c,
      lower(trim(regexp_replace(coalesce(p_variant_name, '') || ' ' || coalesce(p_name, ''), '\s+', ' ', 'g'))) as v,
      lower(trim(coalesce(nullif(p_variant_name, ''), p_name, ''))) as primary_name
  )
  select case
    when v = '' then false
    when trim(coalesce(p_name, '')) = '' and trim(coalesce(p_variant_name, '')) = '' then false
    when c in ('side', 'starter', 'extra') then false
    when primary_name in (
      'takeaway box',
      'take away box',
      'takeaway container',
      'extra 3',
      'extra meat',
      'side rice',
      'side noodles'
    ) then false
    when v ~ '\mextra\M' then false
    when v ~ '\mside\M' then false
    when v ~ 'take\s*away' then false
    when v ~ 'takeaway' then false
    when v ~ '\mbox\M' then false
    when v ~ '\mcontainer\M' then false
    when v ~ '\mpack(?:aging)?\M' then false
    when v ~ '\mbag\M' then false
    when v ~ '\madd[\s-]?on\M' then false
    else true
  end
  from normalized;
$$;

create or replace function public.report_sales_summary(
  p_from_day date,
  p_to_day date,
  p_time_zone text default 'Pacific/Auckland'
)
returns jsonb
language sql
stable
as $$
  with filtered_orders as (
    select
      o.id,
      o.created_at,
      coalesce(o.total_paid, o.total_amount_after_adjustment, 0)::numeric as revenue,
      coalesce(o.total_gst, 0)::numeric as gst,
      timezone(p_time_zone, o.created_at) as local_created_at
    from public.sales_orders o
    where o.created_at is not null
      and coalesce(o.voided, false) = false
      and timezone(p_time_zone, o.created_at)::date between p_from_day and p_to_day
  ),
  series_rows as (
    select
      to_char(
        date_trunc('hour', local_created_at)
        + case when extract(minute from local_created_at) >= 30 then interval '30 minutes' else interval '0 minutes' end,
        'YYYY-MM-DD HH24:MI'
      ) as t,
      round(sum(revenue)::numeric, 2) as revenue,
      count(*)::int as orders
    from filtered_orders
    group by 1
    order by 1
  ),
  totals as (
    select
      round(coalesce(sum(revenue), 0)::numeric, 2) as revenue,
      count(*)::int as orders,
      round(coalesce(sum(gst), 0)::numeric, 2) as gst
    from filtered_orders
  )
  select jsonb_build_object(
    'totals',
    (
      select jsonb_build_object(
        'revenue', revenue,
        'orders', orders,
        'gst', gst
      )
      from totals
    ),
    'series',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            't', t,
            'revenue', revenue,
            'orders', orders
          )
          order by t
        )
        from series_rows
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.report_goods_momentum(
  p_from_day date,
  p_to_day date,
  p_time_zone text default 'Pacific/Auckland'
)
returns jsonb
language sql
stable
as $$
  with settings as (
    select
      p_from_day as from_day,
      p_to_day as to_day,
      ((p_to_day - p_from_day) + 1)::int as range_days,
      (p_from_day - ((p_to_day - p_from_day) + 1))::date as previous_from_day,
      (p_from_day - 1)::date as previous_to_day
  ),
  current_items as (
    select
      trim(coalesce(nullif(i.variant_name, ''), i.name, 'Unknown')) as name,
      round(sum(coalesce(i.quantity, 0))::numeric, 2) as qty
    from public.sales_order_items i
    join public.sales_orders o on o.id = i.order_id
    cross join settings s
    where o.created_at is not null
      and coalesce(o.voided, false) = false
      and timezone(p_time_zone, o.created_at)::date between s.from_day and s.to_day
      and public.is_main_category_item(i.name, i.variant_name)
    group by trim(coalesce(nullif(i.variant_name, ''), i.name, 'Unknown'))
  ),
  previous_items as (
    select
      trim(coalesce(nullif(i.variant_name, ''), i.name, 'Unknown')) as name,
      round(sum(coalesce(i.quantity, 0))::numeric, 2) as qty
    from public.sales_order_items i
    join public.sales_orders o on o.id = i.order_id
    cross join settings s
    where o.created_at is not null
      and coalesce(o.voided, false) = false
      and timezone(p_time_zone, o.created_at)::date between s.previous_from_day and s.previous_to_day
      and public.is_main_category_item(i.name, i.variant_name)
    group by trim(coalesce(nullif(i.variant_name, ''), i.name, 'Unknown'))
  ),
  combined as (
    select
      coalesce(c.name, p.name) as name,
      coalesce(c.qty, 0)::numeric as current_qty,
      coalesce(p.qty, 0)::numeric as previous_qty
    from current_items c
    full outer join previous_items p on p.name = c.name
  ),
  ranked as (
    select
      name,
      round(current_qty, 2) as current_qty,
      round(previous_qty, 2) as previous_qty,
      round(current_qty - previous_qty, 2) as delta_qty,
      case
        when previous_qty > 0 then round((((current_qty - previous_qty) / previous_qty) * 100)::numeric, 1)
        when current_qty > 0 then null
        else -100::numeric
      end as delta_pct,
      case
        when previous_qty = 0 and current_qty > 0 then 'new'
        when current_qty = 0 and previous_qty > 0 then 'dropped'
        when current_qty - previous_qty > 0 then 'up'
        else 'down'
      end as status
    from combined
    where current_qty <> previous_qty
  ),
  fastest as (
    select *
    from ranked
    where delta_qty > 0
    order by delta_qty desc, name asc
    limit 15
  ),
  slowest as (
    select *
    from ranked
    where delta_qty < 0
    order by delta_qty asc, name asc
    limit 15
  )
  select jsonb_build_object(
    'filterScope', 'main_only',
    'currentLabel', (select from_day::text || ' → ' || to_day::text from settings),
    'previousLabel', (select previous_from_day::text || ' → ' || previous_to_day::text from settings),
    'fastest',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', name,
            'currentQty', current_qty,
            'previousQty', previous_qty,
            'deltaQty', delta_qty,
            'deltaPct', delta_pct,
            'status', status
          )
          order by delta_qty desc, name asc
        )
        from fastest
      ),
      '[]'::jsonb
    ),
    'slowest',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', name,
            'currentQty', current_qty,
            'previousQty', previous_qty,
            'deltaQty', delta_qty,
            'deltaPct', delta_pct,
            'status', status
          )
          order by delta_qty asc, name asc
        )
        from slowest
      ),
      '[]'::jsonb
    )
  );
$$;
