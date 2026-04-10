"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./raw.module.css";

function isoDateLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function RawExportPage() {
  const [fromDay, setFromDay] = useState(() => isoDateLocal(new Date()));
  const [toDay, setToDay] = useState(() => isoDateLocal(new Date()));
  const [timeZone, setTimeZone] = useState("Pacific/Auckland");
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState<"all" | "50" | "100" | "200" | "500">("all");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<unknown | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [useRpc, setUseRpc] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; phase: string } | null>(null);

  function setPageSizeFromEvent(value: string) {
    if (value === "all" || value === "50" || value === "100" || value === "200" || value === "500") {
      setPageSize(value);
    }
  }

  const url = useMemo(() => {
    const qp = new URLSearchParams({
      fromDay,
      toDay,
      timeZone,
      all: pageSize === "all" ? "1" : "0",
      pageIndex: String(pageIndex),
      pageSize: pageSize === "all" ? "200" : pageSize,
    });
    return `/api/raw/sale-history?${qp.toString()}`;
  }, [fromDay, toDay, timeZone, pageIndex, pageSize]);

  async function fetchPreview() {
    setLoading(true);
    try {
      const res = await fetch(url);
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      setPreview(json);
    } finally {
      setLoading(false);
    }
  }

  async function exportJson() {
    setLoading(true);
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok) {
        alert(text || `Export failed (HTTP ${res.status})`);
        return;
      }
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download =
        pageSize === "all"
          ? `salehistory_raw_${fromDay}_${toDay}.json`
          : `salehistory_raw_p${pageIndex}_s${pageSize}_${fromDay}_${toDay}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } finally {
      setLoading(false);
    }
  }

  async function importToDb() {
    if (!importFile) return;
    setLoading(true);
    setImportStatus(null);
    setProgress({ done: 0, total: 1, phase: "Reading file..." });
    try {
      const text = await importFile.text();
      const json = text ? JSON.parse(text) : null;

      const items: unknown[] = Array.isArray(json?.items) ? json.items : [];
      if (items.length === 0) {
        setImportStatus("ERROR: file has no items[]");
        return;
      }

      // Chunked upload so we can show progress.
      const chunkSize = 50;
      let importedOrders = 0;
      let importedItems = 0;
      let importedTransactions = 0;

      setProgress({ done: 0, total: items.length, phase: "Uploading..." });

      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const res = await fetch("/api/import/salehistory/chunk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk, provider: "madamyen" }),
        });
        const out = await res.json().catch(() => null);
        if (!res.ok) {
          setImportStatus(`ERROR: ${JSON.stringify(out)}`);
          return;
        }
        importedOrders += Number(out?.importedOrders ?? 0);
        importedItems += Number(out?.importedItems ?? 0);
        importedTransactions += Number(out?.importedTransactions ?? 0);
        setProgress({ done: Math.min(i + chunk.length, items.length), total: items.length, phase: "Uploading..." });
      }

      setProgress({ done: items.length, total: items.length, phase: "Done" });
      setImportStatus(
        `OK: importedOrders=${importedOrders} importedItems=${importedItems} importedTransactions=${importedTransactions}`
      );
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Raw JSON Export</h1>
            <p className={styles.sub}>
              Tool nay dung de tai raw SaleHistory JSON de ban import len Supabase. Co the chon paging hoac All (auto paginate).
            </p>
          </div>
          <nav className={styles.nav}>
            <Link className={styles.navLink} href="/admin/report">
              Report
            </Link>
            <Link className={styles.navLink} href="/">
              Home
            </Link>
            <button className={styles.navLink} type="button" onClick={logout}>
              Logout
            </button>
          </nav>
        </header>

        <section className={styles.panel}>
          <div className={styles.grid}>
            <div className={styles.field}>
              <div className={styles.label}>From day</div>
              <div className={styles.row}>
                <input
                  className={`${styles.input} ${styles.dateInput}`}
                  type="date"
                  value={fromDay}
                  onChange={(e) => setFromDay(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.label}>To day</div>
              <div className={styles.row}>
                <input
                  className={`${styles.input} ${styles.dateInput}`}
                  type="date"
                  value={toDay}
                  onChange={(e) => setToDay(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.label}>Timezone</div>
              <div className={styles.row}>
                <input className={styles.input} value={timeZone} onChange={(e) => setTimeZone(e.target.value)} />
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.label}>Page size</div>
              <div className={styles.row}>
                <select className={styles.select} value={pageSize} onChange={(e) => setPageSizeFromEvent(e.target.value)}>
                  {/* Values match the union type above */}
                  <option value="all">All (auto paginate)</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="500">500</option>
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.label}>Page index</div>
              <div className={styles.row}>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  value={pageIndex}
                  onChange={(e) => setPageIndex(Number(e.target.value))}
                  disabled={pageSize === "all"}
                />
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.label}>API URL</div>
              <div className={styles.row}>
                <input className={styles.input} value={url} readOnly />
              </div>
            </div>
          </div>

          <div className={styles.ctaRow}>
            <button className={styles.cta} type="button" onClick={exportJson} disabled={loading}>
              {loading ? "..." : "Export JSON"}
            </button>
            <button className={styles.secondary} type="button" onClick={fetchPreview} disabled={loading}>
              Preview
            </button>
            <div className={styles.hint}>
              All mode se fetch tat ca pages (PageSize 200). Paging mode chi fetch 1 page theo PageIndex/PageSize.
            </div>
          </div>
        </section>

        {preview != null ? (
          <section className={styles.preview}>
            <div className={styles.label}>Preview</div>
            <pre className={styles.pre}>{JSON.stringify(preview, null, 2)}</pre>
          </section>
        ) : null}

        <section className={styles.importPanel}>
          <div className={styles.label}>Import To Supabase</div>
          <p className={styles.sub}>
            Upload file raw JSON va server se normalize + upsert vao `sales_orders`, `sales_order_items`, `sales_transactions`.
            Can set `SUPABASE_URL` va `SUPABASE_SERVICE_ROLE_KEY` trong env.
          </p>
          <div className={styles.row}>
            <input
              className={styles.fileInput}
              type="file"
              accept="application/json"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className={styles.row} style={{ marginTop: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#334155" }}>
              <input type="checkbox" checked={useRpc} onChange={(e) => setUseRpc(e.target.checked)} />
              Atomic (RPC per order)
            </label>
          </div>
          <div className={styles.ctaRow}>
            <button className={styles.cta} type="button" onClick={importToDb} disabled={loading || !importFile}>
              {loading ? "..." : "Import Now"}
            </button>
            <div className={styles.hint}>
              RPC mode se rollback tung order neu loi. Batch mode nhanh hon nhung khong atomic ca 3 bang trong 1 order.
            </div>
          </div>
          {importStatus && (
            <pre className={styles.pre} style={{ marginTop: 10 }}>
              {importStatus}
            </pre>
          )}

          {progress && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
                />
              </div>
              <div className={styles.progressText}>
                {progress.phase} {progress.done}/{progress.total}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
