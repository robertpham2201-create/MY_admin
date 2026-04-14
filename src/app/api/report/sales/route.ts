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

    const orders = await fetchAllRows<OrderRow>((from, to) =>
      supabase
        .from("sales_orders")
        .select("id,created_at,total_paid,total_gst,total_amount_after_adjustment")
        .gte("created_at", fromStartUtc)
        .lte("created_at", toEndUtc)
        .range(from, to)
    );

    // 30-minute time-series
    const series: Array<{ t: string; revenue: number; orders: number }> = [];

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
    }

    const keysSorted = Array.from(byKey.keys()).sort();
    for (const k of keysSorted) {
      const v = byKey.get(k)!;
      series.push({ t: k, revenue: nzd(v.revenue), orders: v.orders });
    }

    return NextResponse.json({
      ok: true,
      range: { fromDay, toDay, timeZone },
      totals: {
        revenue: nzd((orders ?? []).reduce((s, it) => s + (typeof it.total_paid === "number" ? it.total_paid : 0), 0)),
        orders: (orders ?? []).length,
        gst: nzd((orders ?? []).reduce((s, it) => s + (typeof it.total_gst === "number" ? it.total_gst : 0), 0)),
      },
      series,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}
