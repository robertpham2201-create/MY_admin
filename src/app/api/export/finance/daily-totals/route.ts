import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: "bad_request", message }, { status: 400 });
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function normalizeDayParam(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return value;
}

function ensureMaxRangeDays(fromDay: string, toDay: string, maxDaysInclusive: number) {
  const from = DateTime.fromISO(fromDay, { zone: "utc" }).startOf("day");
  const to = DateTime.fromISO(toDay, { zone: "utc" }).startOf("day");
  const daysInclusive = Math.floor(to.diff(from, "days").days) + 1;
  return { daysInclusive, ok: daysInclusive > 0 && daysInclusive <= maxDaysInclusive };
}

export async function GET(request: Request) {
  try {
    const expected = requireEnv("FINANCE_EXPORT_SECRET");
    const provided = request.headers.get("x-finance-secret") ?? "";
    if (!provided || provided !== expected) return unauthorized();

    const url = new URL(request.url);
    const fromDay = normalizeDayParam(url.searchParams.get("fromDay"));
    const toDay = normalizeDayParam(url.searchParams.get("toDay"));
    const timeZone = "Pacific/Auckland";

    if (!fromDay || !toDay) return badRequest("Missing/invalid fromDay/toDay (YYYY-MM-DD)");

    const range = ensureMaxRangeDays(fromDay, toDay, 31);
    if (!range.ok) return badRequest("Range too large (max 31 days) or invalid date order");

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data, error } = await (supabase as any).rpc("finance_daily_totals", {
      p_from_day: fromDay,
      p_to_day: toDay,
      p_time_zone: timeZone,
    });
    if (error) throw new Error(error.message);

    const days = Array.isArray(data) ? data : [];

    return NextResponse.json({
      ok: true,
      timeZone,
      fromDay,
      toDay,
      days,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}

