"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = useMemo(() => sp.get("next") || "/admin/report", [sp]);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || `HTTP ${res.status}`);
        return;
      }
      router.push(nextPath);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_560px_at_10%_10%,rgba(56,189,248,0.25),transparent_60%),radial-gradient(900px_520px_at_95%_0%,rgba(34,197,94,0.18),transparent_55%),radial-gradient(900px_520px_at_50%_95%,rgba(245,158,11,0.16),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="rounded-[28px] border border-slate-200/70 bg-white/80 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.22em] text-slate-500">MY ADMIN</div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Dang nhap</h1>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Key only
              </span>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Nhap <span className="font-semibold text-slate-900">ADMIN_API_KEY</span> de vao report va raw export.
            </p>

            <div className="mt-6">
              <label className="block text-xs font-semibold text-slate-700">Admin key</label>
              <div className="mt-2">
                <input
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10"
                  type="password"
                  placeholder="Paste key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                />
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              <button
                onClick={submit}
                disabled={loading || !apiKey}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Continue"}
              </button>
              <a
                href="/"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Back to home
              </a>
            </div>

            <div className="mt-5 text-xs text-slate-500">
              Next: <span className="font-semibold text-slate-700">{nextPath}</span>
            </div>
          </div>

          <div className="mt-5 text-center text-xs text-slate-500">
            Vercel env: set <span className="font-semibold text-slate-700">ADMIN_API_KEY</span> (Production).
          </div>
        </div>
      </div>
    </div>
  );
}
