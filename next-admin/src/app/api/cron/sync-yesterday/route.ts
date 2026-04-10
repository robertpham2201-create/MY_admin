import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { createClient } from "@supabase/supabase-js";

const TIME_ZONE = "Pacific/Auckland";

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function requireCronSecret(request: Request) {
  const expected = requireEnv("CRON_SECRET");
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

function baseUrl() {
  return requireEnv("MADAMYEN_BASE_URL").replace(/\/+$/, "");
}

async function loginAndGetToken(): Promise<string> {
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

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Token HTTP ${res.status}: ${JSON.stringify(json)}`);
  const accessToken =
    json && typeof json === "object" && "access_token" in json ? String((json as AnyRecord)["access_token"] ?? "") : "";
  if (!accessToken) throw new Error("Token response missing access_token");
  return accessToken;
}

async function fetchSaleHistoryAllPages(fromDay: string, toDay: string, pageSize = 200) {
  const token = await loginAndGetToken();
  const from = `${DateTime.fromISO(fromDay, { zone: TIME_ZONE }).toFormat("dd/LL/yyyy")} 00:00:00`;
  const to = `${DateTime.fromISO(toDay, { zone: TIME_ZONE }).toFormat("dd/LL/yyyy")} 23:59:59`;

  const fetchPage = async (pageIndex: number) => {
    const res = await fetch(`${baseUrl()}/API/api/SaleHistory/?timeZone=${encodeURIComponent(TIME_ZONE)}`, {
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
    const data: unknown = text ? JSON.parse(text) : null;
    return { ok: res.ok, status: res.status, data };
  };

  const first = await fetchPage(1);
  if (!first.ok) throw new Error(`SaleHistory HTTP ${first.status}: ${JSON.stringify(first.data)}`);
  const result = isRecord(first.data) ? (first.data["Result"] as unknown) : null;
  const totalPages =
    isRecord(result) && typeof result["TotalPageCount"] === "number" ? Math.max(1, Math.floor(result["TotalPageCount"] as number)) : 1;
  const items = isRecord(result) && Array.isArray(result["Items"]) ? (result["Items"] as unknown[]) : [];

  for (let pi = 2; pi <= totalPages; pi++) {
    const page = await fetchPage(pi);
    if (!page.ok) break;
    const r = isRecord(page.data) ? (page.data["Result"] as unknown) : null;
    const its = isRecord(r) && Array.isArray(r["Items"]) ? (r["Items"] as unknown[]) : [];
    items.push(...its);
  }

  return { items, totalPages, pageSize };
}

function intOrNull(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}
function textOrNull(v: unknown) {
  return typeof v === "string" && v.trim() ? v : null;
}
function numOrNull(v: unknown) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function parseDmyAmPmToUtcIso(s: unknown): string | null {
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

async function upsertBatches(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: AnyRecord[],
  conflictTarget: string,
  batchSize = 300
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflictTarget });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

async function importToSupabase(items: unknown[], provider: string) {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const orders: AnyRecord[] = [];
  const orderItems: AnyRecord[] = [];
  const transactions: AnyRecord[] = [];

  for (const it of items) {
    if (!isRecord(it)) continue;
    const orderId = intOrNull(it["Id"]);
    if (!orderId) continue;

    orders.push({
      id: orderId,
      provider,
      created_at: parseDmyAmPmToUtcIso(it["CreateOn"]),
      last_updated_at: parseDmyAmPmToUtcIso(it["LastUpdatedOn"]),
      station_id: intOrNull(it["StationId"]),
      station: textOrNull(it["Station"]),
      user_id: intOrNull(it["UserId"]),
      staff: textOrNull(it["Staff"]),
      table_id: intOrNull(it["TableId"]),
      table_name: textOrNull(it["TableName"]),
      order_status: intOrNull(it["OrderStatus"]),
      daily_id: intOrNull(it["DailyId"]),
      invoice_number: textOrNull(it["InoviceNumber"]),
      is_take_away: typeof it["IsTakeAway"] === "boolean" ? (it["IsTakeAway"] as boolean) : null,
      is_dinein: typeof it["IsDinein"] === "boolean" ? (it["IsDinein"] as boolean) : null,
      voided: typeof it["Voided"] === "boolean" ? (it["Voided"] as boolean) : null,
      total_paid: numOrNull(it["TotalPaid"]),
      total_gst: numOrNull(it["TotalGst"]),
      total_amount_after_adjustment: numOrNull(it["TotalAmountAfterAdjustment"]),
      total_amount_before_adjustment: numOrNull(it["TotalAmountBeforeAdjustment"]),
      total_to_pay: numOrNull(it["TotalToPay"]),
      raw_json: it,
    });

    const products = it["Products"];
    if (Array.isArray(products)) {
      for (const p of products) {
        if (!isRecord(p) || !isRecord(p["Product"])) continue;
        const prod = p["Product"] as AnyRecord;
        const lineId = intOrNull(prod["Id"]);
        if (!lineId) continue;
        orderItems.push({
          line_id: lineId,
          order_id: orderId,
          provider,
          created_at: parseDmyAmPmToUtcIso(prod["CreatedOn"]),
          product_id: intOrNull(prod["ProductId"]),
          name: textOrNull(prod["name"]),
          quantity: numOrNull(prod["Quantity"]),
          sell_price: numOrNull(prod["SellPrice"]),
          total_amount: numOrNull(prod["TotalAmount"]),
          variant_id: intOrNull(prod["VariantId"]),
          variant_name: textOrNull(prod["VariantName"]),
          raw_json: p,
        });
      }
    }

    const txns = it["Transactions"];
    if (Array.isArray(txns)) {
      for (const t of txns) {
        if (!isRecord(t)) continue;
        const txnId = intOrNull(t["Id"]);
        if (!txnId) continue;
        transactions.push({
          id: txnId,
          order_id: orderId,
          provider,
          created_at: parseDmyAmPmToUtcIso(t["CreatedOn"]),
          payment_type: intOrNull(t["PaymentType"]),
          payment_type_name: textOrNull(t["PaymentTypeName"]),
          total_amount: numOrNull(t["TotalAmount"]),
          received: numOrNull(t["Received"]),
          rounding: numOrNull(t["Rounding"]),
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

export async function POST(request: Request) {
  try {
    const authErr = requireCronSecret(request);
    if (authErr) return authErr;

    const provider = (process.env.PROVIDER?.trim() || "madamyen").trim();
    const today = DateTime.now().setZone(TIME_ZONE).startOf("day");
    const y = today.minus({ days: 1 });
    const fromDay = y.toFormat("yyyy-LL-dd");
    const toDay = y.toFormat("yyyy-LL-dd");

    const raw = await fetchSaleHistoryAllPages(fromDay, toDay, 200);
    const imported = await importToSupabase(raw.items, provider);

    return NextResponse.json({
      ok: true,
      job: "sync-yesterday",
      timeZone: TIME_ZONE,
      range: { fromDay, toDay },
      fetchedOrders: raw.items.length,
      ...imported,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}

