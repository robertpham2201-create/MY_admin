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

