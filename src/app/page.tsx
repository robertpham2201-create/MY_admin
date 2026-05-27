export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#02140e] via-[#04241a] to-[#010907] p-4 sm:p-6 md:p-8">
      {/* Background glowing blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-[#006948]/10 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-[#004f36]/15 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-2xl shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[24px_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-10 md:p-12">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-full bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Internal Portal
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Madam Yen
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400/90 sm:text-base">
            Access the restaurant administration panel, sales analytics, and transaction logs.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Open Report Card */}
          <a
            href="/admin/report"
            className="group flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-300 hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] hover:shadow-[0_8px_30px_rgba(16,185,129,0.05)] active:scale-[0.98]"
          >
            <div>
              <div className="inline-flex rounded-xl bg-emerald-500/10 p-3 text-emerald-400 transition-colors group-hover:bg-emerald-500/20">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"
                  />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-bold text-white transition-colors group-hover:text-emerald-400">
                Open Dashboard
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                View real-time visual sales reports, revenue trends, and metrics.
              </p>
            </div>
            <div className="mt-5 flex items-center text-xs font-semibold text-emerald-400">
              Launch Reports <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
            </div>
          </a>

          {/* Raw Export Card */}
          <a
            href="/admin/raw"
            className="group flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-300 hover:border-slate-500/30 hover:bg-slate-500/[0.03] hover:shadow-[0_8px_30px_rgba(255,255,255,0.02)] active:scale-[0.98]"
          >
            <div>
              <div className="inline-flex rounded-xl bg-slate-500/10 p-3 text-slate-400 transition-colors group-hover:bg-slate-500/20">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-bold text-white transition-colors group-hover:text-slate-300">
                Raw Data Export
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Extract raw sales history, invoices, and transaction batches.
              </p>
            </div>
            <div className="mt-5 flex items-center text-xs font-semibold text-slate-400 group-hover:text-slate-300">
              Download CSV <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
            </div>
          </a>
        </div>

        {/* Bottom Login Indicator / Link */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-400/90">
              Security Active
            </span>
          </div>
          <a
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-2 text-xs font-bold text-slate-300 border border-white/5 transition-all duration-300 hover:bg-white/[0.08] hover:border-white/10 hover:text-white active:scale-95"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Account Access
          </a>
        </div>
      </div>
    </main>
  );
}
