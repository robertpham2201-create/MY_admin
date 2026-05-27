"use client";

import Image from "next/image";
import Link from "next/link";
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
    <div className="min-h-screen bg-[#020b08] font-sans text-white">
      <main className="flex min-h-screen">
        {/* Left Side Hero Image (visible on desktop) */}
        <section className="relative hidden overflow-hidden lg:block lg:w-3/5">
          <Image
            alt="Madam Yen restaurant interior"
            src="/login-hero.png"
            priority
            fill
            sizes="60vw"
            className="object-cover grayscale-[20%] brightness-[50%] transition-transform duration-[10000ms] hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#020b08]/20 to-[#020b08]" />
          <div className="absolute bottom-16 left-16 max-w-lg">
            <span className="inline-flex rounded-full border border-[#c5a880]/30 bg-[#c5a880]/5 px-4.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c5a880] backdrop-blur-md">
              Welcome Back
            </span>
            <h2 className="mt-6 font-serif text-4xl font-light leading-tight text-white drop-shadow-md">
              Exquisite Dining & Authentic Vietnamese Flavors
            </h2>
            <p className="mt-4 font-serif text-xs italic leading-relaxed text-slate-300/90">
              Access the administrative core of Madam Yen. Monitor sales performance, generate finance exports, and supervise operations.
            </p>
          </div>
        </section>

        {/* Right Side Form */}
        <section className="relative flex w-full items-center justify-center p-6 sm:p-12 lg:w-2/5">
          {/* Top corner gradient accent */}
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-[#c5a880]/5 blur-3xl pointer-events-none" />

          <div 
            className="w-full max-w-md rounded-3xl border border-[#c5a880]/15 bg-black/45 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
            style={{ padding: "40px" }}
          >
            {/* Header info */}
            <div 
              className="mb-10"
              style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px" }}
            >
              <Link 
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#c5a880] hover:text-[#d5b890] transition-colors"
                style={{ marginBottom: "16px" }}
              >
                <span>&larr;</span> Back to Portal
              </Link>
              <div className="inline-flex rounded-full border border-[#c5a880]/20 bg-[#c5a880]/5 px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-[#c5a880]" style={{ marginBottom: "12px" }}>
                Staff Authorization
              </div>
              <h1 className="font-serif text-4xl font-light tracking-[0.08em] text-white">
                Madam Yen
              </h1>
              <p className="mt-3 font-serif text-xs italic leading-relaxed text-slate-400">
                Enter your unique access code below to authenticate.
              </p>
            </div>

            {/* Input Access Code */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }} 
              className="space-y-6"
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              <div className="space-y-2.5">
                <label 
                  className="block text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400" 
                  htmlFor="access-code"
                >
                  Access Code
                </label>
                <div className="relative group">
                  <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-slate-400 transition-colors group-focus-within:text-[#c5a880]">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <input
                    id="access-code"
                    className="w-full rounded-xl border border-white/5 bg-white/[0.02] py-4 pl-14 pr-4 text-white shadow-inner outline-none transition-all duration-300 placeholder:text-slate-500/60 focus:border-[#c5a880]/30 focus:bg-white/[0.04] focus:ring-4 focus:ring-[#c5a880]/5"
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Enter access code"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              </div>

              {/* Error messages */}
              {error ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3.5 text-xs text-red-400 backdrop-blur-md">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <span>{error}</span>
                </div>
              ) : null}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !apiKey}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#b59870] to-[#c5a880] px-4 py-4 text-sm font-semibold tracking-wide text-black transition-all duration-300 hover:from-[#c5a880] hover:to-[#d5b890] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>{loading ? "Authenticating..." : "Access Dashboard"}</span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
                </button>
              </div>
            </form>

            {/* Footer status */}
            <div 
              className="text-[11px]"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "32px", marginTop: "40px" }}
            >
              <div>
                <p className="font-bold uppercase tracking-[0.2em] text-slate-500">System Status</p>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c5a880] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#c5a880]" />
                  </span>
                  <span className="font-semibold text-[#c5a880]">Services Active</span>
                </div>
              </div>
              <div className="text-right">
                <a className="font-semibold text-slate-400 hover:text-[#c5a880] transition-colors" href="mailto:support@madamyen.com">
                  Request Access
                </a>
                <p className="mt-2 text-[10px] text-slate-500">Target path: {nextPath}</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
