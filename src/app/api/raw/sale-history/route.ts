import { NextResponse } from "next/server";
import { madamyenFetchJson, requireAdminKey } from "@/lib/madamyen";

type SaleHistoryItem = Record<string, unknown>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractItems(upstream: unknown): SaleHistoryItem[] {
  if (!isRecord(upstream)) return [];
  const data = upstream["data"];
  if (!isRecord(data)) return [];
  const result = data["Result"];
  if (!isRecord(result)) return [];
  const items = result["Items"];
  return Array.isArray(items) ? items.filter(isRecord) : [];
}

function extractMeta(upstream: unknown): Record<string, unknown> {
  // `upstream` is the madamyenFetchJson() envelope: { ok, status, data: <api-json> }
  if (!isRecord(upstream)) return {};
  const data = upstream["data"];
  if (!isRecord(data)) return {};
  const result = data["Result"];
  if (!isRecord(result)) return {};
  const keys = [
    "PageSize",
    "TotalCount",
    "TotalPageCount",
    "PageIndex",
    "HasNextPage",
    "HasPreviousPage",
    "Succeeded",
    "ErrorCode",
  ];
  const meta: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in data) meta[k] = (data as Record<string, unknown>)[k];
    if (k in result) meta[k] = (result as Record<string, unknown>)[k];
  }
  meta["Succeeded"] = (data as Record<string, unknown>)["Succeeded"];
  meta["ErrorCode"] = (data as Record<string, unknown>)["ErrorCode"];
  meta["Errors"] = (data as Record<string, unknown>)["Errors"];
  return meta;
}

function toDmy(isoDay: string) {
  // YYYY-MM-DD -> DD/MM/YYYY
  const m = isoDay.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDay;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export async function GET(request: Request) {
  try {
    const authErr = requireAdminKey(request);
    if (authErr) return authErr;

    const url = new URL(request.url);
    const fromDay = url.searchParams.get("fromDay");
    const toDay = url.searchParams.get("toDay");
    const timeZone = url.searchParams.get("timeZone") ?? "Pacific/Auckland";
    const all = (url.searchParams.get("all") ?? "1") !== "0";
    const pageIndexParam = url.searchParams.get("pageIndex");
    const pageSizeParam = url.searchParams.get("pageSize");

    const pageIndex = Math.max(1, Number(pageIndexParam ?? "1") || 1);
    const pageSize = Math.min(500, Math.max(1, Number(pageSizeParam ?? "200") || 200));

    if (!fromDay || !toDay) {
      return NextResponse.json({ ok: false, error: "bad_request", message: "Missing fromDay/toDay (YYYY-MM-DD)" }, { status: 400 });
    }

    const from = `${toDmy(fromDay)} 00:00:00`;
    const to = `${toDmy(toDay)} 23:59:59`;

    const items: SaleHistoryItem[] = [];

    const fetchPage = async (pageIndex: number) =>
      madamyenFetchJson(`/API/api/SaleHistory/?timeZone=${encodeURIComponent(timeZone)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          PageIndex: pageIndex,
          PageSize: pageSize,
          SearchStr: null,
          From: from,
          To: to,
          Filters: { Tables: [], Staffs: [], Pos: [], Status: [] },
          PaymentTypes: [],
        }),
      });

    const first = await fetchPage(all ? 1 : pageIndex);
    if (!first.ok) {
      return NextResponse.json({ ok: false, error: "upstream_error", status: first.status, data: first.data }, { status: 502 });
    }

    items.push(...extractItems(first));

    let totalPages = 1;
    if (all) {
      const dataObj = isRecord(first) ? (first["data"] as unknown) : null;
      if (isRecord(dataObj)) {
        const resultObj = isRecord((dataObj as Record<string, unknown>)["Result"])
          ? ((dataObj as Record<string, unknown>)["Result"] as Record<string, unknown>)
          : null;
        const tp = resultObj ? resultObj["TotalPageCount"] : null;
        if (typeof tp === "number" && Number.isFinite(tp)) totalPages = Math.max(1, Math.floor(tp));
      }

      for (let pi = 2; pi <= totalPages; pi++) {
        const page = await fetchPage(pi);
        if (!page.ok) break;
        items.push(...extractItems(page));
      }
    }

    return NextResponse.json({
      ok: true,
      range: { fromDay, toDay, timeZone },
      meta: extractMeta(first),
      paging: { all, pageIndex: all ? 1 : pageIndex, pageSize },
      items,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}
