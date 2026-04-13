"use client";

import Link from "next/link";
import { DateTime } from "luxon";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./report.module.css";

type ReportPayload = {
  ok: boolean;
  range: { fromDay: string; toDay: string; timeZone: string };
  totals: { revenue: number; orders: number; gst: number };
  series: Array<{ t: string; revenue: number; orders: number }>;
  heatmap: { revenue: number[][]; orders: number[][] };
  weekdayCompare: { this: number[]; prev: number[] };
};

function nzd(value: number) {
  try {
    return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(value);
  } catch {
    return `${value} NZD`;
  }
}

function isoDateLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function slotLabel(slot: number) {
  const hour = Math.floor(slot / 2);
  const min = slot % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${min}`;
}

function Heatmap({ values }: { values: number[][] }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const max = useMemo(() => Math.max(1, ...values.flat()), [values]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>Restaurant Pulse (Heatmap)</div>
          <div className={styles.cardSub}>
            Doanh thu theo thu trong tuan va tung khung 30 phut. Tim ra gio vang va gio chet de toi uu ca truc.
          </div>
        </div>
      </div>
      <div className={styles.heatWrap}>
        <div className={styles.heatGrid}>
          <div />
          {Array.from({ length: 48 }, (_, i) => (
            <div key={i} className={styles.heatTick}>
              {i % 2 === 0 ? String(i / 2).padStart(2, "0") : ""}
            </div>
          ))}
          {values.map((row, di) => (
            <div key={di} style={{ display: "contents" }}>
              <div className={styles.heatLabel}>{days[di]}</div>
              {row.map((v, si) => {
                const intensity = Math.min(1, v / max);
                const bg = `rgba(15,118,110,${0.08 + intensity * 0.92})`;
                return (
                  <div
                    key={si}
                    className={styles.heatCell}
                    style={{ background: bg }}
                    title={`${days[di]} ${slotLabel(si)} • ${nzd(v)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.legend}>
        <span>Low</span>
        <span className={styles.legendBar} />
        <span>High</span>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const tz = "Pacific/Auckland";

  type RangePreset =
    | "yesterday"
    | "today"
    | "this_week"
    | "last_week"
    | "this_month"
    | "last_month"
    | "this_year"
    | "last_year"
    | "custom";

  const [preset, setPreset] = useState<RangePreset>("yesterday");
  const [customFrom, setCustomFrom] = useState(() => isoDateLocal(new Date()));
  const [customTo, setCustomTo] = useState(() => isoDateLocal(new Date()));

  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    const now = DateTime.now().setZone(tz);

    const startOfWeek = (dt: DateTime) => dt.startOf("day").minus({ days: dt.weekday - 1 }); // Mon..Sun
    const endOfWeek = (dt: DateTime) => startOfWeek(dt).plus({ days: 6 });

    if (preset === "yesterday") {
      const d = now.minus({ days: 1 }).startOf("day");
      const iso = d.toISODate()!;
      return { fromDay: iso, toDay: iso };
    }
    if (preset === "today") {
      const d = now.startOf("day");
      const iso = d.toISODate()!;
      return { fromDay: iso, toDay: iso };
    }
    if (preset === "this_week") {
      const s = startOfWeek(now);
      const e = endOfWeek(now);
      return { fromDay: s.toISODate()!, toDay: e.toISODate()! };
    }
    if (preset === "last_week") {
      const base = now.minus({ weeks: 1 });
      const s = startOfWeek(base);
      const e = endOfWeek(base);
      return { fromDay: s.toISODate()!, toDay: e.toISODate()! };
    }
    if (preset === "this_month") {
      const s = now.startOf("month");
      const e = now.endOf("month").startOf("day");
      return { fromDay: s.toISODate()!, toDay: e.toISODate()! };
    }
    if (preset === "last_month") {
      const base = now.minus({ months: 1 });
      const s = base.startOf("month");
      const e = base.endOf("month").startOf("day");
      return { fromDay: s.toISODate()!, toDay: e.toISODate()! };
    }
    if (preset === "this_year") {
      const s = now.startOf("year");
      const e = now.endOf("year").startOf("day");
      return { fromDay: s.toISODate()!, toDay: e.toISODate()! };
    }
    if (preset === "last_year") {
      const base = now.minus({ years: 1 });
      const s = base.startOf("year");
      const e = base.endOf("year").startOf("day");
      return { fromDay: s.toISODate()!, toDay: e.toISODate()! };
    }

    // custom
    return { fromDay: customFrom, toDay: customTo };
  }, [preset, customFrom, customTo, tz]);

  const weekdayBars = useMemo(() => {
    if (!data) return [];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((d, i) => ({
      day: d,
      this: data.weekdayCompare.this[i] ?? 0,
      prev: data.weekdayCompare.prev[i] ?? 0,
    }));
  }, [data]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams({ ...range, timeZone: tz });
      const res = await fetch(`/api/report/sales?${qp.toString()}`);
      const json = (await res.json()) as ReportPayload;
      setData(json.ok ? json : null);
    } finally {
      setLoading(false);
    }
  }, [range, tz]);

  useEffect(() => {
    // Default: generate report for yesterday on first load.
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exportRawJson() {
    const qp = new URLSearchParams({ ...range, timeZone: tz, all: "1" });
    const res = await fetch(`/api/raw/sale-history?${qp.toString()}`);
    const text = await res.text();
    if (!res.ok) {
      // If something goes wrong, at least surface the error payload.
      alert(text || `Export failed (HTTP ${res.status})`);
      return;
    }

    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salehistory_raw_${range.fromDay}_${range.toDay}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    if (!data) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      range,
      report: data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restaurant-report_${range.fromDay}_${range.toDay}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
          <div className={styles.titleWrap}>
            <div className={styles.badge}>Operations Intelligence</div>
            <h1 className={styles.title}>Restaurant Report</h1>
            <p className={styles.subtitle}>
              Tong hop nhip doanh thu theo tung 30 phut, so sanh theo thu, phan tich mon va hanh vi mua hang. Tat ca tinh toan o server. TZ {tz}.
            </p>
          </div>
          <nav className={styles.nav}>
            <Link className={styles.navLink} href="/">
              Home
            </Link>
            <Link className={styles.navLink} href="/admin/raw">
              Raw Export
            </Link>
            <button className={styles.navLink} type="button" onClick={logout}>
              Logout
            </button>
          </nav>
        </header>

        <section className={styles.panel}>
          <div className={styles.panelRow}>
            <div className={styles.modeGroup}>
              <select
                className={styles.segButton}
                value={preset}
                onChange={(e) => setPreset(e.target.value as RangePreset)}
                aria-label="Range preset"
              >
                <option value="yesterday">Yesterday</option>
                <option value="today">Today</option>
                <option value="this_week">This week (Mon-Sun)</option>
                <option value="last_week">Last week (Mon-Sun)</option>
                <option value="this_month">This month</option>
                <option value="last_month">Last month</option>
                <option value="this_year">This year</option>
                <option value="last_year">Last year</option>
                <option value="custom">Custom range</option>
              </select>

              {preset === "custom" ? (
                <div className={styles.modeGroup}>
                  <input
                    className={`${styles.segButton} ${styles.dateInput}`}
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    aria-label="From day"
                  />
                  <span style={{ color: "#64748b", fontWeight: 800 }}>→</span>
                  <input
                    className={`${styles.segButton} ${styles.dateInput}`}
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    aria-label="To day"
                  />
                </div>
              ) : null}
            </div>
            <div className={styles.rangePill}>
              Range: {range.fromDay} → {range.toDay}
            </div>
          </div>

          <div className={styles.ctaRow}>
            <button className={styles.cta} type="button" onClick={fetchReport} disabled={loading}>
              {loading ? "Analyzing..." : "Generate report"}
            </button>
            <button className={styles.ctaSecondary} type="button" onClick={exportJson} disabled={!data || loading}>
              Export JSON
            </button>
            <button className={styles.ctaTertiary} type="button" onClick={exportRawJson} disabled={loading}>
              Export Raw JSON
            </button>
            <div className={styles.helper}>
              Goi API `/api/report/sales` de fetch SaleHistory (tat ca pages) va tong hop theo khung 30 phut.
            </div>
          </div>
        </section>

        {!data && (
          <div className={styles.empty}>
            Bam <b>Generate report</b> de xem Heatmap 30 phut, gio vang, xu huong theo thu, phan tich mon va hanh vi combo.
          </div>
        )}

        {data && (
          <section className={styles.grid}>
            <div className={styles.kpiGrid}>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Revenue</div>
                <div className={styles.kpiValue}>{nzd(data.totals.revenue)}</div>
                <div className={styles.kpiDesc}>Tong doanh thu da thu trong khoang thoi gian dang xem.</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Orders</div>
                <div className={styles.kpiValue}>{data.totals.orders}</div>
                <div className={styles.kpiDesc}>Tong so hoa don thanh cong trong khoang nay.</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>GST</div>
                <div className={styles.kpiValue}>{nzd(data.totals.gst)}</div>
                <div className={styles.kpiDesc}>Tong GST trong khoang du lieu nay.</div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>Revenue Time-Series (30m)</div>
                  <div className={styles.cardSub}>Doanh thu theo tung moc 30 phut de nhin nhip ban hang tang giam.</div>
                </div>
              </div>
              <div className={styles.chart}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#64748b" }} minTickGap={28} stroke="#cbd5e1" />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} stroke="#cbd5e1" />
                    <Tooltip
                      formatter={(v: unknown) => nzd(Number(v))}
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid rgba(148,163,184,0.35)",
                        boxShadow: "0 14px 35px rgba(15,23,42,0.14)",
                      }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2.5} fill="url(#revFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <Heatmap values={data.heatmap.revenue} />

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>Weekday Comparison</div>
                  <div className={styles.cardSub}>
                    So sanh doanh thu theo thu giua khoang hien tai va tuan truoc (vd Thu 7 tuan nay vs Thu 7 tuan truoc).
                  </div>
                </div>
              </div>
              <div className={styles.chartSmall}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdayBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fill: "#64748b" }} stroke="#cbd5e1" />
                    <YAxis tick={{ fill: "#64748b" }} stroke="#cbd5e1" />
                    <Tooltip
                      formatter={(v: unknown) => nzd(Number(v))}
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid rgba(148,163,184,0.35)",
                        boxShadow: "0 14px 35px rgba(15,23,42,0.14)",
                      }}
                    />
                    <Bar dataKey="prev" fill="#94a3b8" name="Prev week" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="this" fill="#0f766e" name="This range" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
