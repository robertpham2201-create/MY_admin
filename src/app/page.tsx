export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Restaurant Report</h1>
        <p className="mt-2 text-sm text-slate-600">Open the report dashboard (requires login).</p>
        <div className="mt-4 grid gap-2 text-sm">
          <a className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white" href="/admin/report">
            Open Report
          </a>
          <a className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white" href="/admin/raw">
            Raw Export
          </a>
          <a className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-800" href="/login">
            Login
          </a>
        </div>
      </div>
    </main>
  );
}
