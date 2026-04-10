import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { createClient } from "@supabase/supabase-js";
import { requireAdminKey } from "@/lib/madamyen";

type OrderRow = {
  id: number;
  created_at: string | null;
  total_paid: number | null;
  total_gst?: number | null;
  total_amount_after_adjustment?: number | null;
};

type OrderItemRow = {
  order_id: number;
  name: string | null;
};

function addDaysIso(isoDay: string, deltaDays: number): string {
  const m = isoDay.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDay;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]) - 1;
  const dd = Number(m[3]);
  const d = new Date(Date.UTC(yyyy, mm, dd));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function slot30m(hour: number, min: number) {
  const half = min >= 30 ? 1 : 0;
  return hour * 2 + half; // 0..47
}

function nzd(value: number) {
  return Math.round(value * 100) / 100;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function fetchAllRows<T>(
  // Supabase query builders are awaitable/thenable, not plain Promise typed.
  queryFactory: (from: number, to: number) => any
): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  for (let page = 0; page < 10000; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = (await queryFactory(from, to)) as { data: T[] | null; error: { message: string } | null };
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

export async function GET(request: Request) {
  try {
    const authErr = requireAdminKey(request);
    if (authErr) return authErr;

    const url = new URL(request.url);
    const fromDay = url.searchParams.get("fromDay");
    const toDay = url.searchParams.get("toDay");
    const timeZone = url.searchParams.get("timeZone") ?? "Pacific/Auckland";

    if (!fromDay || !toDay) {
      return NextResponse.json({ ok: false, error: "bad_request", message: "Missing fromDay/toDay (YYYY-MM-DD)" }, { status: 400 });
    }

    // Supabase-backed: query normalized tables
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const fromStartUtc = DateTime.fromISO(fromDay, { zone: timeZone }).startOf("day").toUTC().toISO();
    const toEndUtc = DateTime.fromISO(toDay, { zone: timeZone }).endOf("day").toUTC().toISO();

    const prevFromStartUtc = DateTime.fromISO(addDaysIso(fromDay, -7), { zone: timeZone }).startOf("day").toUTC().toISO();
    const prevToEndUtc = DateTime.fromISO(addDaysIso(toDay, -7), { zone: timeZone }).endOf("day").toUTC().toISO();

    const orders = await fetchAllRows<OrderRow>((from, to) =>
      supabase
        .from("sales_orders")
        .select("id,created_at,total_paid,total_gst,total_amount_after_adjustment")
        .gte("created_at", fromStartUtc)
        .lte("created_at", toEndUtc)
        .range(from, to)
    );

    const prevOrders = await fetchAllRows<OrderRow>((from, to) =>
      supabase
        .from("sales_orders")
        .select("id,created_at,total_paid,total_amount_after_adjustment")
        .gte("created_at", prevFromStartUtc)
        .lte("created_at", prevToEndUtc)
        .range(from, to)
    );

    const orderIds = (orders ?? []).map((o) => o.id);
    const orderItems: OrderItemRow[] = [];
    if (orderIds.length) {
      const chunkSize = 500;
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize) as number[];
        const rows = await fetchAllRows<OrderItemRow>((from, to) =>
          supabase.from("sales_order_items").select("order_id,name").in("order_id", chunk).range(from, to)
        );
        orderItems.push(...rows);
      }
    }

    // Map order_id -> [product names]
    const namesByOrder = new Map<number, string[]>();
    for (const row of orderItems ?? []) {
      const orderId = row.order_id as number;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!orderId || !name) continue;
      const list = namesByOrder.get(orderId) ?? [];
      list.push(name);
      namesByOrder.set(orderId, list);
    }

    // 30-minute time-series + heatmap (weekday x slot)
    const series: Array<{ t: string; revenue: number; orders: number }> = [];
    const heat: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 48 }, () => 0));
    const heatOrders: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 48 }, () => 0));
    const slotTotals: number[] = Array.from({ length: 48 }, () => 0);
    const slotOrders: number[] = Array.from({ length: 48 }, () => 0);
    const weekdayTotals: number[] = Array.from({ length: 7 }, () => 0);
    const weekdayTotalsPrev: number[] = Array.from({ length: 7 }, () => 0);

    const byKey = new Map<string, { revenue: number; orders: number }>();
    for (const it of orders ?? []) {
      const createdAtIso = typeof it.created_at === "string" ? it.created_at : null;
      if (!createdAtIso) continue;
      const dt = DateTime.fromISO(createdAtIso, { zone: "utc" }).setZone(timeZone);
      const dayKey = dt.toFormat("yyyy-LL-dd");
      const slot = slot30m(dt.hour, dt.minute);
      const k = `${dayKey} ${dt.toFormat("HH")}:${dt.minute < 30 ? "00" : "30"}`;
      const revenue =
        (typeof it.total_paid === "number" ? it.total_paid : 0) ||
        (typeof it.total_amount_after_adjustment === "number" ? it.total_amount_after_adjustment : 0) ||
        0;
      const cur = byKey.get(k) ?? { revenue: 0, orders: 0 };
      cur.revenue += revenue;
      cur.orders += 1;
      byKey.set(k, cur);

      const dowSun0 = dt.weekday % 7; // luxon: 1=Mon..7=Sun, but weekday%7 gives 0 for Sun
      const w = (dowSun0 + 6) % 7; // 0=Mon..6=Sun
      heat[w][slot] += revenue;
      heatOrders[w][slot] += 1;
      slotTotals[slot] += revenue;
      slotOrders[slot] += 1;
      weekdayTotals[w] += revenue;
    }

    const keysSorted = Array.from(byKey.keys()).sort();
    for (const k of keysSorted) {
      const v = byKey.get(k)!;
      series.push({ t: k, revenue: nzd(v.revenue), orders: v.orders });
    }

    for (const it of prevOrders ?? []) {
      const createdAtIso = typeof it.created_at === "string" ? it.created_at : null;
      if (!createdAtIso) continue;
      const dt = DateTime.fromISO(createdAtIso, { zone: "utc" }).setZone(timeZone);
      const dowSun0 = dt.weekday % 7;
      const w = (dowSun0 + 6) % 7;
      const revenue =
        (typeof it.total_paid === "number" ? it.total_paid : 0) ||
        (typeof it.total_amount_after_adjustment === "number" ? it.total_amount_after_adjustment : 0) ||
        0;
      weekdayTotalsPrev[w] += revenue;
    }

    // Golden/dead slots across the selected range
    let golden = { slot: 0, revenue: -1 };
    let dead = { slot: 0, revenue: Number.POSITIVE_INFINITY };
    for (let i = 0; i < 48; i++) {
      if (slotTotals[i] > golden.revenue) golden = { slot: i, revenue: slotTotals[i] };
      if (slotTotals[i] > 0 && slotTotals[i] < dead.revenue) dead = { slot: i, revenue: slotTotals[i] };
    }
    if (!Number.isFinite(dead.revenue)) dead = { slot: golden.slot, revenue: golden.revenue };

    return NextResponse.json({
      ok: true,
      range: { fromDay, toDay, timeZone },
      totals: {
        revenue: nzd((orders ?? []).reduce((s, it) => s + (typeof it.total_paid === "number" ? it.total_paid : 0), 0)),
        orders: (orders ?? []).length,
        gst: nzd((orders ?? []).reduce((s, it) => s + (typeof it.total_gst === "number" ? it.total_gst : 0), 0)),
      },
      golden: { slot: golden.slot, revenue: nzd(golden.revenue), orders: slotOrders[golden.slot] ?? 0 },
      dead: { slot: dead.slot, revenue: nzd(dead.revenue), orders: slotOrders[dead.slot] ?? 0 },
      series,
      heatmap: { revenue: heat.map((r) => r.map(nzd)), orders: heatOrders },
      weekdayCompare: {
        this: weekdayTotals.map(nzd),
        prev: weekdayTotalsPrev.map(nzd),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}
