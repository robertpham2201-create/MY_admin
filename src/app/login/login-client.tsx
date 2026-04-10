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
    <div className="relative min-h-screen overflow-hidden bg-[#0b0f1a] text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(900px_500px_at_20%_20%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(700px_420px_at_80%_25%,rgba(34,197,94,0.16),transparent_60%),radial-gradient(900px_520px_at_50%_90%,rgba(244,114,182,0.12),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold tracking-widest text-slate-300/80">MY ADMIN</div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Sign in</h1>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                API key
              </span>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-200/80">
              Nhap <span className="font-semibold text-slate-100">ADMIN_API_KEY</span> de truy cap report va raw export.
            </p>

            <div className="mt-6">
              <label className="block text-xs font-semibold text-slate-200/80">Admin key</label>
              <div className="mt-2">
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-400/70 outline-none ring-0 transition focus:border-white/30 focus:bg-black/40"
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
              <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              <button
                onClick={submit}
                disabled={loading || !apiKey}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Continue"}
              </button>
              <a
                href="/"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
              >
                Back to home
              </a>
            </div>

            <div className="mt-5 text-xs text-slate-200/70">
              Next: <span className="font-semibold text-slate-100">{nextPath}</span>
            </div>
          </div>

          <div className="mt-5 text-center text-xs text-slate-300/70">
            Vercel env: set <span className="font-semibold text-slate-100">ADMIN_API_KEY</span> (Production).
          </div>
        </div>
      </div>
    </div>
  );
}
