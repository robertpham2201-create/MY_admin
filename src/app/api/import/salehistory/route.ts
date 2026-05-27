import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { createClient } from "@supabase/supabase-js";
import { requireAdminKey } from "@/lib/madamyen";

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function parseDmyAmPmToUtcIso(s: unknown, zone = "Pacific/Auckland"): string | null {
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
  const dt = DateTime.fromObject(
    { year: yyyy, month: mm, day: dd, hour: hh, minute: min, second: 0, millisecond: 0 },
    { zone }
  );
  if (!dt.isValid) return null;
  return dt.toUTC().toISO();
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function intOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}

function textOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

async function upsertBatches(
  // Keep this `any` to avoid supabase-js generic inference issues in Next.js build.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  rows: AnyRecord[],
  onConflict: string,
  batchSize: number
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    // supabase-js typing can infer `never` for dynamic table names; runtime is fine.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(table).upsert(slice as any, { onConflict });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

export async function POST(request: Request) {
  try {
    const authErr = requireAdminKey(request);
    if (authErr) return authErr;

    const { rawJson, provider, useRpc } = (await request.json().catch(() => ({}))) as {
      rawJson?: unknown;
      provider?: unknown;
      useRpc?: unknown;
    };

    if (!rawJson || !isRecord(rawJson) || !Array.isArray((rawJson as AnyRecord).items)) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "Expected { rawJson: { items: [...] } }" },
        { status: 400 }
      );
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const providerName = typeof provider === "string" && provider.trim() ? provider.trim() : "madamyen";
    const atomic = useRpc === true;

    const items = (rawJson as AnyRecord).items as unknown[];

    if (atomic) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!isRecord(it)) continue;
        const enriched: AnyRecord = {
          ...it,
          created_at: parseDmyAmPmToUtcIso(it.CreateOn),
          last_updated_at: parseDmyAmPmToUtcIso(it.LastUpdatedOn),
        };

        if (Array.isArray(enriched.Products)) {
          enriched.Products = enriched.Products.map((p) => {
            if (!isRecord(p) || !isRecord(p.Product)) return p;
            return { ...p, Product: { ...(p.Product as AnyRecord), created_at: parseDmyAmPmToUtcIso((p.Product as AnyRecord).CreatedOn, "utc") } };
          });
        }
        if (Array.isArray(enriched.Transactions)) {
          enriched.Transactions = enriched.Transactions.map((t) => {
            if (!isRecord(t)) return t;
            return { ...t, created_at: parseDmyAmPmToUtcIso((t as AnyRecord).CreatedOn) };
          });
        }

        const { error } = await supabase.rpc("upsert_salehistory_order", {
          p_provider: providerName,
          p_order: enriched,
        });
        if (error) throw new Error(`RPC upsert failed at index=${i}: ${error.message}`);
      }

      return NextResponse.json({ ok: true, mode: "rpc", importedOrders: items.length });
    }

    const orders: AnyRecord[] = [];
    const orderItems: AnyRecord[] = [];
    const transactions: AnyRecord[] = [];

    for (const it of items) {
      if (!isRecord(it)) continue;
      const orderId = typeof it.Id === "number" ? Math.trunc(it.Id) : null;
      if (!orderId) continue;

      orders.push({
        id: orderId,
        provider: providerName,
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
        total_paid: num(it.TotalPaid),
        total_gst: num(it.TotalGst),
        total_amount_after_adjustment: num(it.TotalAmountAfterAdjustment),
        total_amount_before_adjustment: num(it.TotalAmountBeforeAdjustment),
        total_to_pay: num(it.TotalToPay),
        raw_json: it,
      });

      if (Array.isArray(it.Products)) {
        for (const p of it.Products) {
          if (!isRecord(p) || !isRecord(p.Product)) continue;
          const prod = p.Product as AnyRecord;
          const lineId = typeof prod.Id === "number" ? Math.trunc(prod.Id) : null;
          if (!lineId) continue;
          orderItems.push({
            line_id: lineId,
            order_id: orderId,
            provider: providerName,
            created_at: parseDmyAmPmToUtcIso(prod.CreatedOn, "utc"),
            product_id: intOrNull(prod.ProductId),
            name: textOrNull(prod.name),
            quantity: num(prod.Quantity),
            sell_price: num(prod.SellPrice),
            total_amount: num(prod.TotalAmount),
            variant_id: intOrNull(prod.VariantId),
            variant_name: textOrNull(prod.VariantName),
            raw_json: p,
          });
        }
      }

      if (Array.isArray(it.Transactions)) {
        for (const t of it.Transactions) {
          if (!isRecord(t)) continue;
          const txnId = typeof (t as AnyRecord).Id === "number" ? Math.trunc((t as AnyRecord).Id as number) : null;
          if (!txnId) continue;
          transactions.push({
            id: txnId,
            order_id: orderId,
            provider: providerName,
            created_at: parseDmyAmPmToUtcIso((t as AnyRecord).CreatedOn),
            payment_type: intOrNull((t as AnyRecord).PaymentType),
            payment_type_name: textOrNull((t as AnyRecord).PaymentTypeName),
            total_amount: num((t as AnyRecord).TotalAmount),
            received: num((t as AnyRecord).Received),
            rounding: num((t as AnyRecord).Rounding),
            raw_json: t,
          });
        }
      }
    }

    const batchSize = 300;
    await upsertBatches(supabase, "sales_orders", orders, "id", batchSize);
    await upsertBatches(supabase, "sales_order_items", orderItems, "line_id", batchSize);
    await upsertBatches(supabase, "sales_transactions", transactions, "id", batchSize);

    return NextResponse.json({
      ok: true,
      mode: "batch",
      importedOrders: orders.length,
      importedItems: orderItems.length,
      importedTransactions: transactions.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}
