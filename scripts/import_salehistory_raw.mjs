import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseDmyAmPm(s, zone = "Pacific/Auckland") {
  // "10/04/2026 02:20 PM" -> ISO timestamp, parsed in Pacific/Auckland
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

function toIso(iso) {
  return iso ?? null;
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function intOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}

function textOrNull(v) {
  return typeof v === "string" ? v : null;
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const file = requireEnv("IMPORT_FILE");
  const provider = process.env.PROVIDER ?? "madamyen";
  const batchSize = Number(process.env.BATCH_SIZE ?? "300");
  const useRpc = (process.env.USE_RPC ?? "0") === "1";

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  const raw = JSON.parse(await fs.readFile(abs, "utf-8"));
  const items = Array.isArray(raw?.items) ? raw.items : [];

  const orders = [];
  const orderItems = [];
  const transactions = [];

  for (const it of items) {
    if (!isRecord(it)) continue;
    const orderId = typeof it.Id === "number" ? Math.trunc(it.Id) : null;
    if (!orderId) continue;

    const createdAt = toIso(parseDmyAmPm(it.CreateOn));
    const updatedAt = toIso(parseDmyAmPm(it.LastUpdatedOn));

    orders.push({
      id: orderId,
      provider,
      created_at: createdAt,
      last_updated_at: updatedAt,
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
        const prod = p.Product;
        const lineId = typeof prod.Id === "number" ? Math.trunc(prod.Id) : null;
        if (!lineId) continue;
        orderItems.push({
          line_id: lineId,
          order_id: orderId,
          provider,
          created_at: toIso(parseDmyAmPm(prod.CreatedOn, "utc")),
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
        const txnId = typeof t.Id === "number" ? Math.trunc(t.Id) : null;
        if (!txnId) continue;
        transactions.push({
          id: txnId,
          order_id: orderId,
          provider,
          created_at: toIso(parseDmyAmPm(t.CreatedOn)),
          payment_type: intOrNull(t.PaymentType),
          payment_type_name: textOrNull(t.PaymentTypeName),
          total_amount: num(t.TotalAmount),
          received: num(t.Received),
          rounding: num(t.Rounding),
          raw_json: t,
        });
      }
    }
  }

  async function upsertBatches(table, rows, onConflict) {
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const { error } = await client.from(table).upsert(slice, { onConflict });
      if (error) throw new Error(`${table} upsert failed: ${error.message}`);
      process.stdout.write(`Upserted ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}\n`);
    }
  }

  process.stdout.write(`Parsed: orders=${orders.length}, items=${orderItems.length}, txns=${transactions.length}\n`);

  if (!useRpc) {
    await upsertBatches("sales_orders", orders, "id");
    await upsertBatches("sales_order_items", orderItems, "line_id");
    await upsertBatches("sales_transactions", transactions, "id");
    process.stdout.write("Done.\n");
    return;
  }

  // Per-order atomic upsert via RPC. Stops on first error.
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!isRecord(it)) continue;

    // Attach parsed timestamps so RPC can store timestamptz without parsing strings in SQL.
    const enriched = {
      ...it,
      created_at: toIso(parseDmyAmPm(it.CreateOn)),
      last_updated_at: toIso(parseDmyAmPm(it.LastUpdatedOn)),
      Products: Array.isArray(it.Products)
        ? it.Products.map((p) => {
            if (!isRecord(p) || !isRecord(p.Product)) return p;
            return {
              ...p,
              Product: { ...p.Product, created_at: toIso(parseDmyAmPm(p.Product.CreatedOn, "utc")) },
            };
          })
        : it.Products,
      Transactions: Array.isArray(it.Transactions)
        ? it.Transactions.map((t) => {
            if (!isRecord(t)) return t;
            return { ...t, created_at: toIso(parseDmyAmPm(t.CreatedOn)) };
          })
        : it.Transactions,
    };

    const { error } = await client.rpc("upsert_salehistory_order", { p_provider: provider, p_order: enriched });
    if (error) throw new Error(`RPC upsert failed at index=${i}: ${error.message}`);
    if (i % 25 === 0) process.stdout.write(`RPC upserted orders: ${i}/${items.length}\n`);
  }

  process.stdout.write("Done.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
