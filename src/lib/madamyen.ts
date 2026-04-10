import { NextResponse } from "next/server";

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

declare global {
  var __madamyenTokenCache: TokenCache | undefined;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

export function requireAdminKey(request: Request) {
  const expected = requireEnv("ADMIN_API_KEY");
  const provided = request.headers.get("x-api-key") ?? "";
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)admin_api_key=([^;]+)/);
  const cookieKey = cookieMatch ? decodeURIComponent(cookieMatch[1] ?? "") : "";

  const effective = provided || cookieKey;
  if (!effective || effective !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

function baseUrl() {
  return requireEnv("MADAMYEN_BASE_URL").replace(/\/+$/, "");
}

export async function loginAndGetToken(): Promise<string> {
  const now = Date.now();
  const cache = globalThis.__madamyenTokenCache;
  if (cache && cache.accessToken && cache.expiresAtMs > now) return cache.accessToken;

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
    typeof json === "object" && json !== null && "access_token" in json
      ? String((json as Record<string, unknown>)["access_token"] ?? "")
      : "";
  if (!accessToken) throw new Error("Token response missing access_token");

  const expiresIn =
    typeof json === "object" && json !== null && "expires_in" in json
      ? Number((json as Record<string, unknown>)["expires_in"] ?? 0)
      : 0;
  globalThis.__madamyenTokenCache = {
    accessToken,
    expiresAtMs: now + Math.max(0, expiresIn - 60) * 1000,
  };
  return accessToken;
}

export function formatDmy(date: Date) {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function buildFromToFromDays(fromDay: string, toDay: string) {
  const fromDate = new Date(`${fromDay}T00:00:00.000Z`);
  const toDate = new Date(`${toDay}T00:00:00.000Z`);
  if (Number.isNaN(fromDate.valueOf()) || Number.isNaN(toDate.valueOf())) {
    throw new Error("Invalid fromDay/toDay (expected YYYY-MM-DD)");
  }
  const from = `${formatDmy(fromDate)} 00:00:00`;
  const to = `${formatDmy(toDate)} 23:59:59`;
  return { from, to };
}

export async function madamyenFetchJson(
  path: string,
  init: RequestInit & { method: string }
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const token = await loginAndGetToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json, text/plain, */*",
      Authorization: `bearer ${token}`,
      Referer: `${baseUrl()}/index.html`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, data };
}
