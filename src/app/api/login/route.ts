import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { apiKey } = (await request.json().catch(() => ({}))) as { apiKey?: unknown };
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) {
      return NextResponse.json({ ok: false, error: "missing_env", message: "Missing ADMIN_API_KEY" }, { status: 500 });
    }
    if (typeof apiKey !== "string" || apiKey !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    const secure = process.env.NODE_ENV === "production";
    res.headers.append(
      "Set-Cookie",
      `admin_api_key=${encodeURIComponent(apiKey)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${
        secure ? "; Secure" : ""
      }`
    );
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
  }
}

