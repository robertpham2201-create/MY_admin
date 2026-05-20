"use client";

import Link from "next/link";
import { DateTime } from "luxon";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
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
  goodsMomentum: null | {
    filterScope: "main_only";
    currentLabel: string;
    previousLabel: string;
    fastest: Array<{
      name: string;
      currentQty: number;
      previousQty: number;
      deltaQty: number;
      deltaPct: number | null;
      status: "up" | "down" | "new" | "dropped";
    }>;
    slowest: Array<{
      name: string;
      currentQty: number;
      previousQty: number;
      deltaQty: number;
      deltaPct: number | null;
      status: "up" | "down" | "new" | "dropped";
    }>;
  };
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

function pctText(value: number | null) {
  if (value == null) return "New";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function qtyText(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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
      const e = now.startOf("day");
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
              Tong hop doanh thu theo tung moc 30 phut va xu huong ban hang theo ky. TZ {tz}.
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
          </div>
        </section>

        {!data && (
          <div className={styles.empty}>
            Bam <b>Generate report</b> de xem bieu do doanh thu theo tung moc 30 phut va cac chi so tong quan.
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

            {data.goodsMomentum ? (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitle}>Mon ban nhanh / cham hon ky truoc</div>
                    <div className={styles.cardSub}>
                      So sanh tong so luong ban trong ky hien tai voi ky truoc cung do dai. Chi tinh mon chinh, bo side, extra va takeaway box.
                    </div>
                  </div>
                </div>

                <div className={styles.compareMeta}>
                  <span className={styles.comparePill}>Current: {data.goodsMomentum.currentLabel}</span>
                  <span className={styles.comparePill}>Previous: {data.goodsMomentum.previousLabel}</span>
                </div>

                <div className={styles.momentumGrid}>
                  <div className={styles.momentumPanel}>
                    <div className={styles.momentumTitle}>Ban nhanh hon ky truoc</div>
                    <div className={styles.momentumTable}>
                      <div className={styles.momentumHead}>
                        <span>Mon</span>
                        <span>Qty</span>
                        <span>Prev</span>
                        <span>Delta</span>
                      </div>
                      {data.goodsMomentum.fastest.length ? (
                        data.goodsMomentum.fastest.map((item) => (
                          <div key={`fast-${item.name}`} className={styles.momentumRow}>
                            <span className={styles.itemName}>{item.name}</span>
                            <span>{qtyText(item.currentQty)}</span>
                            <span>{qtyText(item.previousQty)}</span>
                            <span className={styles.positiveDelta}>
                              +{qtyText(item.deltaQty)} · {pctText(item.deltaPct)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.emptyTable}>Khong co mon tang toc trong ky nay.</div>
                      )}
                    </div>
                  </div>

                  <div className={styles.momentumPanel}>
                    <div className={styles.momentumTitle}>Ban cham hon ky truoc</div>
                    <div className={styles.momentumTable}>
                      <div className={styles.momentumHead}>
                        <span>Mon</span>
                        <span>Qty</span>
                        <span>Prev</span>
                        <span>Delta</span>
                      </div>
                      {data.goodsMomentum.slowest.length ? (
                        data.goodsMomentum.slowest.map((item) => (
                          <div key={`slow-${item.name}`} className={styles.momentumRow}>
                            <span className={styles.itemName}>{item.name}</span>
                            <span>{qtyText(item.currentQty)}</span>
                            <span>{qtyText(item.previousQty)}</span>
                            <span className={styles.negativeDelta}>
                              {qtyText(item.deltaQty)} · {pctText(item.deltaPct)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.emptyTable}>Khong co mon giam toc trong ky nay.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
