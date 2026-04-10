import { DateTime } from "luxon";
import { createClient } from "@supabase/supabase-js";

const TIME_ZONE = "Pacific/Auckland";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function baseUrl() {
  return requireEnv("MADAMYEN_BASE_URL").replace(/\/+$/, "");
}

function dmyForZone(dt) {
  return dt.setZone(TIME_ZONE).toFormat("dd/LL/yyyy");
}

async function loginAndGetToken() {
  const accountName = requireEnv("MADAMYEN_ACCOUNT_NAME");
  const userName = requireEnv("MADAMYEN_USERNAME");
  const password = requireEnv("MADAMYEN_PASSWORD");

  const body = new URLSearchParams({
    userName,
    password,
    grant_type: "password",
    accountName,
  });

  const res = await fetch(`${baseUrl()}/API/token`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: baseUrl(),
      Referer: `${baseUrl()}/index.html`,
    },
    body,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Token HTTP ${res.status}: ${JSON.stringify(json)}`);
  const accessToken = json && typeof json === "object" ? String(json.access_token ?? "") : "";
  if (!accessToken) throw new Error("Token response missing access_token");
  return accessToken;
}

async function fetchSaleHistoryAllPages({ fromDay, toDay, timeZone = TIME_ZONE, pageSize = 200 }) {
  const token = await loginAndGetToken();
  const from = `${dmyForZone(DateTime.fromISO(fromDay, { zone: TIME_ZONE }))} 00:00:00`;
  const to = `${dmyForZone(DateTime.fromISO(toDay, { zone: TIME_ZONE }))} 23:59:59`;

  const fetchPage = async (pageIndex) => {
    const res = await fetch(`${baseUrl()}/API/api/SaleHistory/?timeZone=${encodeURIComponent(timeZone)}`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        Authorization: `bearer ${token}`,
        Referer: `${baseUrl()}/index.html`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        PageIndex: pageIndex,
        PageSize: pageSize,
        SearchStr: null,
        From: from,
        To: to,
        Filters: { Tables: [], Staffs: [], Pos: [], Status: [] },
        PaymentTypes: [],
      }),
      cache: "no-store",
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    return { ok: res.ok, status: res.status, data };
  };

  const first = await fetchPage(1);
  if (!first.ok) throw new Error(`SaleHistory HTTP ${first.status}: ${JSON.stringify(first.data)}`);

  const result = first?.data?.Result ?? null;
  const totalPages = typeof result?.TotalPageCount === "number" ? Math.max(1, Math.floor(result.TotalPageCount)) : 1;
  const items = Array.isArray(result?.Items) ? result.Items : [];

  for (let pi = 2; pi <= totalPages; pi++) {
    const page = await fetchPage(pi);
    if (!page.ok) {
      console.warn(`WARN: page ${pi} failed HTTP ${page.status}`);
      break;
    }
    const r = page?.data?.Result ?? null;
    const its = Array.isArray(r?.Items) ? r.Items : [];
    items.push(...its);
    console.log(`Fetched page ${pi}/${totalPages} (+${its.length})`);
  }

  return { items, meta: result, range: { fromDay, toDay, timeZone }, pageSize };
}

function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function intOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}
function textOrNull(v) {
  return typeof v === "string" && v.trim() ? v : null;
}
function numOrNull(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function parseDmyAmPmToUtcIso(s) {
  if (typeof s !== "string") return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}) (AM|PM)$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  let hh = Number(m[4]);
  const min = Number(m[5]);
  const ap = m[6];
  if (ap === "PM" && hh !== 12) hh += 12;
  if (ap === "AM" && hh === 12) hh = 0;
  return DateTime.fromObject({ year: yyyy, month: mm, day: dd, hour: hh, minute: min, second: 0 }, { zone: TIME_ZONE })
    .toUTC()
    .toISO({ suppressMilliseconds: true });
}

async function upsertBatches(supabase, table, rows, conflictTarget, batchSize = 300) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflictTarget });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
    console.log(`Upsert ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }
}

async function importToSupabase(rawJson, provider = "madamyen") {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const items = Array.isArray(rawJson?.items) ? rawJson.items : [];

  const orders = [];
  const orderItems = [];
  const transactions = [];

  for (const it of items) {
    if (!isRecord(it)) continue;
    const orderId = intOrNull(it.Id);
    if (!orderId) continue;

    orders.push({
      id: orderId,
      provider,
      created_at: parseDmyAmPmToUtcIso(it.CreateOn),
      last_updated_at: parseDmyAmPmToUtcIso(it.LastUpdatedOn),
      station_id: intOrNull(it.StationId),
      station: textOrNull(it.Station),
      user_id: intOrNull(it.UserId),
      staff: textOrNull(it.Staff),
      table_id: intOrNull(it.TableId),
      table_name: textOrNull(it.TableName),
      order_status: intOrNull(it.OrderStatus),
      daily_id: intOrNull(it.DailyId),
      invoice_number: textOrNull(it.InoviceNumber),
      is_take_away: typeof it.IsTakeAway === "boolean" ? it.IsTakeAway : null,
      is_dinein: typeof it.IsDinein === "boolean" ? it.IsDinein : null,
      voided: typeof it.Voided === "boolean" ? it.Voided : null,
      total_paid: numOrNull(it.TotalPaid),
      total_gst: numOrNull(it.TotalGst),
      total_amount_after_adjustment: numOrNull(it.TotalAmountAfterAdjustment),
      total_amount_before_adjustment: numOrNull(it.TotalAmountBeforeAdjustment),
      total_to_pay: numOrNull(it.TotalToPay),
      raw_json: it,
    });

    if (Array.isArray(it.Products)) {
      for (const p of it.Products) {
        if (!isRecord(p) || !isRecord(p.Product)) continue;
        const prod = p.Product;
        const lineId = intOrNull(prod.Id);
        if (!lineId) continue;
        orderItems.push({
          line_id: lineId,
          order_id: orderId,
          provider,
          created_at: parseDmyAmPmToUtcIso(prod.CreatedOn),
          product_id: intOrNull(prod.ProductId),
          name: textOrNull(prod.name),
          quantity: numOrNull(prod.Quantity),
          sell_price: numOrNull(prod.SellPrice),
          total_amount: numOrNull(prod.TotalAmount),
          variant_id: intOrNull(prod.VariantId),
          variant_name: textOrNull(prod.VariantName),
          raw_json: p,
        });
      }
    }

    if (Array.isArray(it.Transactions)) {
      for (const t of it.Transactions) {
        if (!isRecord(t)) continue;
        const txnId = intOrNull(t.Id);
        if (!txnId) continue;
        transactions.push({
          id: txnId,
          order_id: orderId,
          provider,
          created_at: parseDmyAmPmToUtcIso(t.CreatedOn),
          payment_type: intOrNull(t.PaymentType),
          payment_type_name: textOrNull(t.PaymentTypeName),
          total_amount: numOrNull(t.TotalAmount),
          received: numOrNull(t.Received),
          rounding: numOrNull(t.Rounding),
          raw_json: t,
        });
      }
    }
  }

  await upsertBatches(supabase, "sales_orders", orders, "id");
  await upsertBatches(supabase, "sales_order_items", orderItems, "line_id");
  await upsertBatches(supabase, "sales_transactions", transactions, "id");

  return { importedOrders: orders.length, importedItems: orderItems.length, importedTransactions: transactions.length };
}

async function main() {
  const provider = process.env.PROVIDER?.trim() || "madamyen";
  const today = DateTime.now().setZone(TIME_ZONE).startOf("day");
  const y = today.minus({ days: 1 });
  const fromDay = y.toFormat("yyyy-LL-dd");
  const toDay = y.toFormat("yyyy-LL-dd");

  console.log(`[cron] Sync SaleHistory: ${fromDay} (${TIME_ZONE})`);

  const raw = await fetchSaleHistoryAllPages({ fromDay, toDay, timeZone: TIME_ZONE, pageSize: 200 });
  console.log(`[cron] Fetched items=${raw.items.length}`);

  const imported = await importToSupabase({ items: raw.items }, provider);
  console.log(`[cron] Imported`, imported);
}

main().catch((e) => {
  console.error(`[cron] FAILED`, e);
  process.exit(1);
});

