import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { createClient } from "@supabase/supabase-js";
import { requireAdminKey } from "@/lib/madamyen";

type SalesSummaryRpc = {
  totals?: {
    revenue?: number;
    orders?: number;
    gst?: number;
  };
  series?: Array<{
    t: string;
    revenue: number;
    orders: number;
  }>;
};

type GoodsMomentumRpc = {
  filterScope: "main_only";
  currentLabel: string;
  previousLabel: string;
  fastest: Array<{
    name: string;
    currentQty: number;
    previousQty: number;
    deltaQty: number;
    deltaPct: number | null;
    status: "up" | "down" | "new" | "dropped";
  }>;
  slowest: Array<{
    name: string;
    currentQty: number;
    previousQty: number;
    deltaQty: number;
    deltaPct: number | null;
    status: "up" | "down" | "new" | "dropped";
  }>;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function normalizeMoney(value: unknown) {
  const num = typeof value === "number" ? value : Number(value ?? 0);
  return Math.round(num * 100) / 100;
}

function normalizeSeries(payload: SalesSummaryRpc | null | undefined) {
  const series = Array.isArray(payload?.series) ? payload.series : [];
  return series.map((point) => ({
    t: String(point.t ?? ""),
    revenue: normalizeMoney(point.revenue),
    orders: Number(point.orders ?? 0),
  }));
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

    const fromDate = DateTime.fromISO(fromDay, { zone: timeZone }).startOf("day");
    const toDate = DateTime.fromISO(toDay, { zone: timeZone }).endOf("day");
    const rangeDays = Math.floor(toDate.startOf("day").diff(fromDate.startOf("day"), "days").days) + 1;

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const [{ data: summaryData, error: summaryError }, { data: momentumData, error: momentumError }] = await Promise.all([
      (supabase as any).rpc("report_sales_summary", {
        p_from_day: fromDay,
        p_to_day: toDay,
        p_time_zone: timeZone,
      }),
      rangeDays > 27
        ? (supabase as any).rpc("report_goods_momentum", {
            p_from_day: fromDay,
            p_to_day: toDay,
            p_time_zone: timeZone,
          })
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (summaryError) throw new Error(summaryError.message);
    if (momentumError) throw new Error(momentumError.message);

    const summary = (summaryData ?? {}) as SalesSummaryRpc;
    const goodsMomentum = (momentumData ?? null) as GoodsMomentumRpc | null;

    return NextResponse.json({
      ok: true,
      range: { fromDay, toDay, timeZone },
      totals: {
        revenue: normalizeMoney(summary.totals?.revenue),
        orders: Number(summary.totals?.orders ?? 0),
        gst: normalizeMoney(summary.totals?.gst),
      },
      series: normalizeSeries(summary),
      goodsMomentum,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}
