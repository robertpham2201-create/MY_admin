"use client";

import { Inter, Manrope } from "next/font/google";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-login-body",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-login-headline",
});

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
    <div
      className={`${inter.variable} ${manrope.variable} min-h-screen bg-[#030c08] text-white`}
      style={{ fontFamily: "var(--font-login-body)" }}
    >
      <main className="flex min-h-screen">
        {/* Left Side Hero Image (visible on desktop) */}
        <section className="relative hidden overflow-hidden lg:block lg:w-3/5">
          <img
            alt="Madam Yen restaurant interior"
            src="/login-hero.png"
            className="absolute inset-0 h-full w-full object-cover grayscale-[20%] brightness-[70%] transition-transform duration-[10000ms] hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#030c08]/20 to-[#030c08]" />
          <div className="absolute bottom-16 left-16 max-w-lg">
            <span className="inline-flex rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-400 backdrop-blur-md">
              Welcome Back
            </span>
            <h2 
              className="mt-6 text-4xl font-extrabold leading-tight text-white drop-shadow-md"
              style={{ fontFamily: "var(--font-login-headline)" }}
            >
              Exquisite Dining & Authentic Vietnamese Flavors
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300/95">
              Access the administrative core of Madam Yen. Monitor sales performance, generate finance exports, and supervise operations.
            </p>
          </div>
        </section>

        {/* Right Side Form */}
        <section className="relative flex w-full items-center justify-center p-6 sm:p-12 lg:w-2/5">
          {/* Top corner gradient accent */}
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

          <div className="w-full max-w-md">
            {/* Header info */}
            <div className="mb-10">
              <a 
                href="/"
                className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span>&larr;</span> Back to Portal
              </a>
              <div className="mb-4 inline-flex rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                Staff Authorization
              </div>
              <h1
                className="text-[2.25rem] font-black tracking-tight text-white"
                style={{ fontFamily: "var(--font-login-headline)" }}
              >
                Madam Yen
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Enter your unique access code below to authenticate.
              </p>
            </div>

            {/* Input Access Code */}
            <div className="space-y-6">
              <div className="space-y-2.5">
                <label 
                  className="block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400" 
                  htmlFor="access-code"
                >
                  Access Code
                </label>
                <div className="relative group">
                  <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-slate-400 transition-colors group-focus-within:text-emerald-400">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <input
                    id="access-code"
                    className="w-full rounded-xl border border-white/5 bg-white/[0.03] py-4 pl-14 pr-4 text-white shadow-inner outline-none transition-all duration-300 placeholder:text-slate-500/60 focus:border-emerald-500/30 focus:bg-white/[0.06] focus:ring-4 focus:ring-emerald-500/5"
                    type="password"
                    placeholder="Enter access code"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && apiKey) submit();
                    }}
                  />
                </div>
              </div>

              {/* Error messages */}
              {error ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3.5 text-xs text-red-400 backdrop-blur-md">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <span>{error}</span>
                </div>
              ) : null}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  onClick={submit}
                  disabled={loading || !apiKey}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-4 text-sm font-bold tracking-tight text-white shadow-[0_12px_24px_rgba(16,185,129,0.15)] transition-all duration-300 hover:from-emerald-500 hover:to-emerald-400 hover:shadow-[0_12px_32px_rgba(16,185,129,0.25)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>{loading ? "Authenticating..." : "Access Dashboard"}</span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
                </button>
              </div>
            </div>

            {/* Footer status */}
            <div className="mt-16 flex items-center justify-between border-t border-white/5 pt-8 text-[11px]">
              <div>
                <p className="font-bold uppercase tracking-[0.2em] text-slate-500">System Status</p>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="font-semibold text-emerald-400">Services Active</span>
                </div>
              </div>
              <div className="text-right">
                <a className="font-semibold text-slate-400 hover:text-emerald-400 transition-colors" href="mailto:support@madamyen.com">
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
