"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  golden: { slot: number; revenue: number; orders: number };
  dead: { slot: number; revenue: number; orders: number };
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

function weekStartMonday(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7; // Mon=0
  date.setDate(date.getDate() - diffToMonday);
  return date;
}

function monthIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthStartEnd(yyyyMm: string) {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error("Invalid month (expected YYYY-MM)");
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
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
  const [mode, setMode] = useState<"day" | "week" | "month">("day");
  const [day, setDay] = useState(() => isoDateLocal(new Date()));
  const [weekStart, setWeekStart] = useState(() => isoDateLocal(weekStartMonday(new Date())));
  const [month, setMonth] = useState(() => monthIso(new Date()));
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    if (mode === "day") return { fromDay: day, toDay: day };
    if (mode === "week") {
      const start = new Date(weekStart + "T00:00:00");
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { fromDay: isoDateLocal(start), toDay: isoDateLocal(end) };
    }
    const { start, end } = monthStartEnd(month);
    return { fromDay: isoDateLocal(start), toDay: isoDateLocal(end) };
  }, [mode, day, weekStart, month]);

  const weekdayBars = useMemo(() => {
    if (!data) return [];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((d, i) => ({
      day: d,
      this: data.weekdayCompare.this[i] ?? 0,
      prev: data.weekdayCompare.prev[i] ?? 0,
    }));
  }, [data]);

  async function fetchReport() {
    setLoading(true);
    try {
      const qp = new URLSearchParams({ ...range, timeZone: tz });
      const res = await fetch(`/api/report/sales?${qp.toString()}`);
      const json = (await res.json()) as ReportPayload;
      setData(json.ok ? json : null);
    } finally {
      setLoading(false);
    }
  }

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

  function bumpDay(delta: number) {
    const d = new Date(day + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDay(isoDateLocal(d));
  }

  function bumpWeek(deltaWeeks: number) {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + deltaWeeks * 7);
    setWeekStart(isoDateLocal(d));
  }

  function bumpMonth(deltaMonths: number) {
    const d = new Date(month + "-01T00:00:00");
    d.setMonth(d.getMonth() + deltaMonths);
    setMonth(monthIso(d));
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
          </nav>
        </header>

        <section className={styles.panel}>
          <div className={styles.panelRow}>
            <div className={styles.modeGroup}>
              <button
                className={`${styles.segButton} ${mode === "day" ? styles.segButtonActive : ""}`}
                onClick={() => setMode("day")}
                type="button"
              >
                Day
              </button>
              <button
                className={`${styles.segButton} ${mode === "week" ? styles.segButtonActive : ""}`}
                onClick={() => setMode("week")}
                type="button"
              >
                Week
              </button>
              <button
                className={`${styles.segButton} ${mode === "month" ? styles.segButtonActive : ""}`}
                onClick={() => setMode("month")}
                type="button"
              >
                Month
              </button>
            </div>
            <div className={styles.rangePill}>
              Range: {range.fromDay} → {range.toDay}
            </div>
          </div>

          <div className={styles.pickGrid}>
            <div className={styles.pickCard}>
              <div className={styles.pickLabel}>Day</div>
              <div className={styles.pickRow}>
                <button className={styles.pillButton} type="button" onClick={() => bumpDay(-1)}>
                  ←
                </button>
                <div className={styles.pillValue}>{day}</div>
                <button className={styles.pillButton} type="button" onClick={() => bumpDay(1)}>
                  →
                </button>
              </div>
            </div>
            <div className={styles.pickCard}>
              <div className={styles.pickLabel}>Week (Mon)</div>
              <div className={styles.pickRow}>
                <button className={styles.pillButton} type="button" onClick={() => bumpWeek(-1)}>
                  ←
                </button>
                <div className={styles.pillValue}>{weekStart}</div>
                <button className={styles.pillButton} type="button" onClick={() => bumpWeek(1)}>
                  →
                </button>
              </div>
            </div>
            <div className={styles.pickCard}>
              <div className={styles.pickLabel}>Month</div>
              <div className={styles.pickRow}>
                <button className={styles.pillButton} type="button" onClick={() => bumpMonth(-1)}>
                  ←
                </button>
                <div className={styles.pillValue}>{month}</div>
                <button className={styles.pillButton} type="button" onClick={() => bumpMonth(1)}>
                  →
                </button>
              </div>
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
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Peak Hour</div>
                <div className={styles.kpiValue}>{slotLabel(data.golden.slot)}</div>
                <div className={styles.kpiDesc}>Khung gio doanh thu cao nhat (lay tu Golden slot).</div>
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitle}>Golden slot</div>
                    <div className={styles.cardSub}>Khung 30 phut doanh thu cao nhat (uu tien nhan su, prep).</div>
                  </div>
                  <div className={styles.pill}>
                    {slotLabel(data.golden.slot)} • {nzd(data.golden.revenue)} • {data.golden.orders} orders
                  </div>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitle}>Dead slot</div>
                    <div className={styles.cardSub}>Khung 30 phut yeu nhat (de dieu chinh ca truc).</div>
                  </div>
                  <div className={styles.pill}>
                    {slotLabel(data.dead.slot)} • {nzd(data.dead.revenue)} • {data.dead.orders} orders
                  </div>
                </div>
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
