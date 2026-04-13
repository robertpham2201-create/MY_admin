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
      className={`${inter.variable} ${manrope.variable} min-h-screen bg-[#f8f9fa] text-[#191c1d]`}
      style={{ fontFamily: "var(--font-login-body)" }}
    >
      <main className="flex min-h-screen">
        <section className="relative hidden overflow-hidden bg-[#e1e3e4] lg:block lg:w-3/5">
          <img
            alt="Restaurant interior"
            src="/login-hero.png"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#002114]/45 via-[#002114]/10 to-transparent" />
        </section>

        <section className="relative flex w-full items-center justify-center bg-[#f8f9fa] lg:w-2/5">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-[999px] bg-[#006948]/5" />
          <div className="w-full max-w-md px-8 py-12">
            <div className="mb-14">
              <div className="mb-5 inline-flex rounded-full bg-[#f3f4f5] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#3d4a42]">
                Staff Login
              </div>
              <h1
                className="text-[2.5rem] font-extrabold tracking-[-0.03em] text-[#191c1d]"
                style={{ fontFamily: "var(--font-login-headline)" }}
              >
                Madam Yen
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#3d4a42]">
                Enter your unique service code to proceed to the workspace.
              </p>
            </div>

            <div className="space-y-8">
              <div className="space-y-2">
                <label className="ml-1 block text-xs font-bold uppercase tracking-[0.22em] text-[#3d4a42]" htmlFor="access-code">
                  Access Code
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#6d7a72]">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 10.5a6.5 6.5 0 1 1-11.6-4" />
                      <path d="M21 10.5h-6" />
                      <path d="M15 10.5v3" />
                      <path d="M12 13.5v2" />
                      <path d="M9.4 6.5 3 12.9V17h4.1l2.5-2.5" />
                    </svg>
                  </div>
                  <input
                    id="access-code"
                    className="w-full rounded-xl border-b-2 border-b-transparent bg-[#f3f4f5] py-4 pl-12 pr-4 text-[#191c1d] shadow-sm outline-none transition-all duration-300 placeholder:text-[#6d7a72]/60 focus:border-b-[#006948] focus:bg-white"
                    type="password"
                    placeholder=".... ...."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">
                  {error}
                </div>
              ) : null}

              <div className="pt-1">
                <button
                  onClick={submit}
                  disabled={loading || !apiKey}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-[linear-gradient(135deg,#006948_0%,#00855d_100%)] px-4 py-4 text-sm font-bold tracking-tight text-white shadow-[0_12px_32px_rgba(0,105,72,0.15)] transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,105,72,0.25)] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                >
                  <span>{loading ? "Entering..." : "Enter Dashboard"}</span>
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>

            <div className="mt-16 flex items-center justify-between border-t border-[#bccac0]/15 pt-8">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#6d7a72]">System Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#006948]" />
                  <span className="text-xs font-semibold text-[#006948]">Service Live</span>
                </div>
              </div>
              <div className="text-right">
                <a className="text-xs font-medium text-[#3d4a42] transition-colors hover:text-[#006948]" href="/">
                  Need help?
                </a>
                <p className="mt-2 text-[11px] text-[#6d7a72]">Next: {nextPath}</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
