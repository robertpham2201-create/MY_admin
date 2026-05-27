export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#020b08] via-[#05140e] to-[#010503] p-4 sm:p-6 md:p-8">
      {/* Background glowing luxury blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-[#c5a880]/5 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-[#004f36]/10 blur-[120px]" />
      </div>
 
      <div 
        className="relative w-full max-w-2xl shrink-0 rounded-3xl border border-[#c5a880]/15 bg-black/60 shadow-[0_24px_80px_rgba(0,0,0,0.8)] backdrop-blur-3xl"
        style={{ padding: "48px 48px 40px", display: "flex", flexDirection: "column", gap: "36px" }}
      >
        {/* Subtle decorative gold top border line */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[#c5a880]/40 to-transparent" />

        <div className="text-center" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="mx-auto mb-5 inline-flex items-center justify-center rounded-full border border-[#c5a880]/20 bg-[#c5a880]/5 px-4.5 py-1 text-[9px] font-bold uppercase tracking-[0.25em] text-[#c5a880]">
            Internal Portal
          </div>
          <h1 className="font-serif text-4xl font-light tracking-[0.08em] text-white sm:text-5xl">
            Madam Yen
          </h1>
          <p className="mt-4 font-serif text-xs italic tracking-wide text-slate-400/90 sm:text-sm">
            Access the restaurant administration panel, sales analytics, and transaction logs.
          </p>
        </div>
 
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Open Report Card */}
          <a
            href="/admin/report"
            className="group flex flex-col justify-between rounded-2xl border border-[#c5a880]/10 bg-[#c5a880]/[0.01] p-6 transition-all duration-500 hover:border-[#c5a880]/30 hover:bg-[#c5a880]/[0.03] hover:shadow-[0_12px_30px_rgba(197,168,128,0.04)] active:scale-[0.98]"
          >
            <div>
              <div className="inline-flex rounded-xl bg-[#c5a880]/10 p-3.5 text-[#c5a880] transition-all duration-300 group-hover:bg-[#c5a880]/20">
                <svg
                  className="h-5.5 w-5.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"
                  />
                </svg>
              </div>
              <h2 className="mt-5 font-serif text-lg font-normal tracking-wide text-white transition-colors group-hover:text-[#c5a880]">
                Open Dashboard
              </h2>
              <p className="mt-2.5 text-xs font-light leading-relaxed text-slate-400/90">
                View real-time visual sales reports, revenue trends, and metrics.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold tracking-wider text-[#c5a880]">
              Launch Reports <span className="ml-1.5 transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
            </div>
          </a>
 
          {/* Raw Export Card */}
          <a
            href="/admin/raw"
            className="group flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.01] p-6 transition-all duration-500 hover:border-emerald-500/20 hover:bg-emerald-500/[0.02] hover:shadow-[0_12px_30px_rgba(16,185,129,0.03)] active:scale-[0.98]"
          >
            <div>
              <div className="inline-flex rounded-xl bg-emerald-500/10 p-3.5 text-emerald-400 transition-all duration-300 group-hover:bg-emerald-500/20">
                <svg
                  className="h-5.5 w-5.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
              <h2 className="mt-5 font-serif text-lg font-normal tracking-wide text-white transition-colors group-hover:text-emerald-400">
                Raw Data Export
              </h2>
              <p className="mt-2.5 text-xs font-light leading-relaxed text-slate-400/90">
                Extract raw sales history, invoices, and transaction batches.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold tracking-wider text-emerald-400">
              Download CSV <span className="ml-1.5 transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
            </div>
          </a>
        </div>
 
        {/* Bottom Login Indicator / Link */}
        <div 
          className="flex flex-col items-center justify-between gap-4 sm:flex-row"
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "32px", width: "100%" }}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c5a880] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c5a880]" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#c5a880]/90">
              Security Active
            </span>
          </div>
          <a
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-[#c5a880]/20 bg-[#c5a880]/5 px-4.5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#c5a880] transition-all duration-300 hover:bg-[#c5a880]/10 hover:border-[#c5a880]/40 active:scale-95"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
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
