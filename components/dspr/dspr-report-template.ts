import { format } from "date-fns";
import type { DsprResponse, DsprGoalMetric } from "@/types/dspr.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  buildDsprReportHtml — renders the "PNE PIZZA / DAILY STORE PERFORMANCE"
 *  Focus-on-the-Five one-pager as a self-contained HTML document string.
 *
 *  All five metrics use DAILY values for the selected date. Goals come from
 *  goal_metrics (matched by name); Customer Service comes from
 *  store_score.details. Anything missing renders "No data" in small font —
 *  no values are fabricated. See the plan file for the full data mapping.
 * ────────────────────────────────────────────────────────────────────────── */

type MetricColor = "green" | "blue" | "purple" | "orange" | "red";

/** One card's worth of injected data. `null` fields render as "No data". */
interface ReportMetric {
  key: string;
  num: number;
  title: string;
  icon: string;
  color: MetricColor;
  /** Formatted headline value (e.g. "$767.51" or "71.88%"), or null. */
  value: string | null;
  /** Numeric percent used for the scorecard ring (0–100), or null. */
  rawValue: number | null;
  goalLabel: string;
  /** Formatted goal (e.g. "$1,200" or "75.00%"), or null when no goal. */
  goal: string | null;
  /** "gauge" (sales % of goal) | "delta" (actual − goal). */
  bottomType: "gauge" | "delta";
  /** For gauge: the % of goal number. For delta: the point difference. null → No data. */
  bottomValue: number | null;
  banner: { icon: string; big: string; small: string };
}

interface ReportData {
  storeId: string;
  date: string;
  metrics: ReportMetric[];
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/** Parse a goal_metrics entry (decimal string like "22.0000") by name substring. */
function goalValueByName(
  metrics: DsprGoalMetric[] | undefined,
  match: (name: string) => boolean,
): number | null {
  const m = metrics?.find((x) => match(x.metric_name.toLowerCase()));
  const raw = m?.goals?.[0]?.goal;
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

const fmtMoney0 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtMoney2 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct2 = (n: number) => `${n.toFixed(2)}%`;

/** Escape a string for safe embedding in HTML text nodes / attributes. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Banner tone derived from performance vs goal (never fabricates numbers). */
function bannerFor(
  color: MetricColor,
  status: "met" | "close" | "behind" | "nodata",
): { icon: string; big: string; small: string } {
  switch (status) {
    case "met":
      return { icon: "fa-solid fa-trophy", big: "GREAT JOB!", small: "KEEP IT UP!" };
    case "close":
      return { icon: "fa-solid fa-bolt", big: "ALMOST THERE!", small: "PUSH TO THE GOAL!" };
    case "behind":
      return { icon: "fa-solid fa-bullseye", big: "FOCUS AREA", small: "LET'S HIT THAT TARGET!" };
    default:
      return { icon: "fa-solid fa-circle-info", big: "NO DATA", small: "NOT AVAILABLE TODAY" };
  }
}

/** Status for a percentage metric compared to its goal. */
function pctStatus(actual: number | null, goal: number | null): "met" | "close" | "behind" | "nodata" {
  if (actual == null) return "nodata";
  if (goal == null) return actual >= 0 ? "met" : "behind"; // no goal → treat as informational
  if (actual >= goal) return "met";
  if (actual >= goal * 0.8) return "close";
  return "behind";
}

/* ── Metric builders ────────────────────────────────────────────────────────── */

function buildMetrics(data: DsprResponse): ReportMetric[] {
  const { sales, day, goal_metrics, store_score, filtering } = data;

  /* (1) Total Sales — daily value = that day's total; daily goal = weekly / 7. */
  const dailySales = sales?.this_week_by_day?.[filtering.date] ?? null;
  const weeklySalesGoal = goalValueByName(goal_metrics, (n) => n.includes("sales"));
  const dailySalesGoal = weeklySalesGoal != null ? weeklySalesGoal / 7 : null;
  const salesPct =
    dailySales != null && dailySalesGoal != null && dailySalesGoal > 0
      ? (dailySales / dailySalesGoal) * 100
      : null;
  const salesStatus = pctStatus(salesPct, salesPct != null ? 100 : null);

  /* (2) Store Score — overall store_score.score out of its max points. */
  const scoreMax = store_score
    ? store_score.details?.reduce((s, d) => s + d.max, 0) || 100
    : null;
  const scoreVal = store_score?.score ?? null;
  const scorePct =
    scoreVal != null && scoreMax != null && scoreMax > 0 ? (scoreVal / scoreMax) * 100 : null;
  const scoreStatus = pctStatus(scorePct, scorePct != null ? 100 : null);
  const fmtScore = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));

  /* (3) Put Into Portal — daily. */
  const portalVal = day?.portal?.put_into_portal_percent ?? null;
  const portalGoal = goalValueByName(
    goal_metrics,
    (n) => n.includes("portal") && (n.includes("put") || n.includes("into")),
  );
  const portalStatus = pctStatus(portalVal, portalGoal);

  /* (4) In Portal On Time — daily. */
  const onTimeVal = day?.portal?.in_portal_on_time_percent ?? null;
  const onTimeGoal = goalValueByName(
    goal_metrics,
    (n) => n.includes("on-time") || n.includes("on time") || (n.includes("portal") && n.includes("time")),
  );
  const onTimeStatus = pctStatus(onTimeVal, onTimeGoal);

  /* (5) HNR Promise Met — daily. */
  const hnrVal = day?.hnr?.hnr_promise_met_percent ?? null;
  const hnrGoal = goalValueByName(goal_metrics, (n) => n.includes("hnr") || n.includes("promise"));
  const hnrStatus = pctStatus(hnrVal, hnrGoal);

  return [
    {
      key: "sales",
      num: 1,
      title: "1. TOTAL SALES",
      icon: "fa-solid fa-dollar-sign",
      color: "green",
      value: dailySales != null ? fmtMoney2(dailySales) : null,
      rawValue: salesPct != null ? Math.min(salesPct, 100) : null,
      goalLabel: "DAILY GOAL",
      goal: dailySalesGoal != null ? fmtMoney0(dailySalesGoal) : null,
      bottomType: "gauge",
      bottomValue: salesPct,
      banner: bannerFor("green", salesStatus),
    },
    {
      key: "score",
      num: 2,
      title: store_score?.label ? `2. STORE SCORE — ${store_score.label.toUpperCase()}` : "2. STORE SCORE",
      icon: "fa-solid fa-star",
      color: "blue",
      value: scoreVal != null ? fmtScore(scoreVal) : null,
      rawValue: scorePct != null ? Math.min(scorePct, 100) : null,
      goalLabel: "OUT OF",
      goal: scoreMax != null ? `${fmtScore(scoreMax)} PTS` : null,
      bottomType: "gauge",
      bottomValue: scorePct,
      banner: bannerFor("blue", scoreStatus),
    },
    {
      key: "portal",
      num: 3,
      title: "3. PUT INTO PORTAL",
      icon: "fa-solid fa-display",
      color: "purple",
      value: portalVal != null ? fmtPct2(portalVal) : null,
      rawValue: portalVal != null ? Math.min(portalVal, 100) : null,
      goalLabel: "DAILY GOAL",
      goal: portalGoal != null ? fmtPct2(portalGoal) : null,
      bottomType: "delta",
      bottomValue: portalVal != null && portalGoal != null ? portalVal - portalGoal : null,
      banner: bannerFor("purple", portalStatus),
    },
    {
      key: "ontime",
      num: 4,
      title: "4. IN PORTAL ON TIME",
      icon: "fa-regular fa-clock",
      color: "orange",
      value: onTimeVal != null ? fmtPct2(onTimeVal) : null,
      rawValue: onTimeVal != null ? Math.min(onTimeVal, 100) : null,
      goalLabel: "DAILY GOAL",
      goal: onTimeGoal != null ? fmtPct2(onTimeGoal) : null,
      bottomType: "delta",
      bottomValue: onTimeVal != null && onTimeGoal != null ? onTimeVal - onTimeGoal : null,
      banner: bannerFor("orange", onTimeStatus),
    },
    {
      key: "hnr",
      num: 5,
      title: "5. HNR PROMISE MET %",
      icon: "fa-solid fa-bullseye",
      color: "red",
      value: hnrVal != null ? fmtPct2(hnrVal) : null,
      rawValue: hnrVal != null ? Math.min(hnrVal, 100) : null,
      goalLabel: "DAILY GOAL",
      goal: hnrGoal != null ? fmtPct2(hnrGoal) : null,
      bottomType: "delta",
      bottomValue: hnrVal != null && hnrGoal != null ? hnrVal - hnrGoal : null,
      banner: bannerFor("red", hnrStatus),
    },
  ];
}

/* ── Public API ─────────────────────────────────────────────────────────────── */

export function buildDsprReportHtml(data: DsprResponse, selectedDate: Date): string {
  const reportData: ReportData = {
    storeId: esc(data.filtering?.store ?? "—"),
    date: esc(format(selectedDate, "M/d/yyyy")),
    metrics: buildMetrics(data),
  };

  // Serialize safely for embedding inside a <script> tag.
  const json = JSON.stringify(reportData).replace(/</g, "\\u003c");

  return DOCUMENT(json);
}

/* ──────────────────────────────────────────────────────────────────────────
 *  The template document. Markup + <style> are copied from the provided
 *  dashboard (1).html; the <script> is adapted to read injected REPORT_DATA
 *  and render "No data" small-font wherever a field is null.
 * ────────────────────────────────────────────────────────────────────────── */

const DOCUMENT = (reportJson: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PNE Pizza — Daily Store Performance</title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Permanent+Marker&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

<style>
  :root {
    --orange-header: #D85A1E;
    --orange-accent: #E8651F;
    --green: #2E9F45;
    --green-dark: #258a39;
    --blue: #1E6FD9;
    --blue-dark: #1a60bf;
    --purple: #7B3FB8;
    --purple-dark: #6a35a0;
    --orange-icon: #E8651F;
    --orange-dark: #c8521a;
    --red: #E13F2E;
    --red-dark: #c43325;
    --text-dark: #1a1a1a;
    --text-muted: #6c6c6c;
    --bg-page: #ffffff;
    --card-bg: #ffffff;
    --section-bg: #fafafa;
    --border: #e6e6e6;
    --footer-dark: #2b2b2b;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    background: #efefef;
    font-family: 'Inter', sans-serif;
    color: var(--text-dark);
    -webkit-font-smoothing: antialiased;
  }

  .dashboard {
    max-width: 1180px;
    margin: 20px auto;
    background: var(--bg-page);
    box-shadow: 0 4px 22px rgba(0,0,0,.08);
    overflow: hidden;
  }

  .top-bar {
    background: var(--orange-header);
    color: #fff;
    display: grid;
    grid-template-columns: 130px 1fr 130px;
    align-items: center;
    padding: 14px 30px;
    position: relative;
  }

  .logo-placeholder {
    width: 78px;
    height: 78px;
    background: #f0e6d8;
    border: 2px dashed #ffffff80;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8a6a3a;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    line-height: 1.1;
    margin-top: -8px;
    margin-bottom: -22px;
    position: relative;
    z-index: 2;
  }

  .brand {
    text-align: center;
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 36px;
    letter-spacing: 1px;
  }

  .dspr {
    text-align: right;
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 30px;
    letter-spacing: 2px;
  }

  .title-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: flex-start;
    padding: 22px 30px 6px;
    gap: 20px;
  }

  .title-row h1 {
    font-family: 'Anton', sans-serif;
    font-size: 52px;
    letter-spacing: 0.5px;
    line-height: 1;
    color: var(--text-dark);
  }

  .title-row .tagline {
    font-family: 'Oswald', sans-serif;
    font-weight: 500;
    font-size: 17px;
    color: #777;
    letter-spacing: 3px;
    margin-top: 8px;
  }

  .info-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 280px;
  }

  .info-row {
    display: grid;
    grid-template-columns: 90px 1fr;
    background: #f3f3f3;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(0,0,0,.05);
  }

  .info-label {
    background: var(--orange-header);
    color: #fff;
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    letter-spacing: 1.5px;
    font-size: 14px;
    padding: 10px 14px;
    text-align: center;
  }

  .info-value {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 15px;
    padding: 10px 14px;
    color: #333;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0;
    padding: 18px 22px 0;
    background: var(--section-bg);
    border-radius: 10px;
    margin: 0 18px;
  }

  .metric {
    padding: 22px 14px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    border-right: 1px solid #ececec;
    position: relative;
  }
  .metric:last-child { border-right: none; }

  .metric-icon {
    width: 78px;
    height: 78px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 36px;
    margin-bottom: 14px;
    box-shadow: 0 4px 10px rgba(0,0,0,.12);
  }
  .ic-green  { background: var(--green); }
  .ic-blue   { background: var(--blue); }
  .ic-purple { background: var(--purple); }
  .ic-orange { background: var(--orange-icon); }
  .ic-red    { background: var(--red); }

  .metric-title {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 17px;
    letter-spacing: 0.5px;
    line-height: 1.15;
    min-height: 42px;
    margin-bottom: 14px;
  }
  .t-green  { color: var(--green); }
  .t-blue   { color: var(--blue); }
  .t-purple { color: var(--purple); }
  .t-orange { color: var(--orange-icon); }
  .t-red    { color: var(--red); }

  .metric-value {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 38px;
    color: #111;
    line-height: 1;
    margin-bottom: 22px;
  }

  .metric-sub-label {
    font-family: 'Oswald', sans-serif;
    font-weight: 500;
    letter-spacing: 1.5px;
    font-size: 12px;
    color: #888;
  }

  .metric-sub-value {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 22px;
    color: #1a1a1a;
    margin-top: 4px;
    margin-bottom: 18px;
  }

  .metric-trend-label {
    font-family: 'Oswald', sans-serif;
    font-weight: 500;
    letter-spacing: 1.5px;
    font-size: 12px;
    color: #888;
  }

  .trend-up, .trend-down {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 20px;
    margin-top: 4px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .trend-up   { color: var(--green); }
  .trend-down { color: var(--red); }

  /* "No data" — small, muted (used wherever a metric/goal is unavailable) */
  .nodata {
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 500;
    color: #999;
    letter-spacing: 0.3px;
  }

  .gauge {
    width: 130px;
    height: 70px;
    position: relative;
    margin-top: 4px;
  }
  .gauge svg { width: 100%; height: 100%; display: block; }
  .gauge-value {
    position: absolute;
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 22px;
    color: #111;
  }

  .banners {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
    padding: 14px 22px 22px;
    margin: 0 18px;
    background: var(--section-bg);
    border-radius: 0 0 10px 10px;
  }

  .banner {
    color: #fff;
    border-radius: 8px;
    padding: 14px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 2px 6px rgba(0,0,0,.12);
    min-height: 78px;
  }

  .banner i { font-size: 26px; flex-shrink: 0; }

  .banner-text {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.6px;
    line-height: 1.25;
    text-transform: uppercase;
  }

  .b-green  { background: var(--green); }
  .b-blue   { background: var(--blue); }
  .b-purple { background: var(--purple); }
  .b-orange { background: var(--orange-icon); }
  .b-red    { background: var(--red); }
  .b-gray   { background: #9aa0a6; }

  .bottom-grid {
    display: grid;
    grid-template-columns: 1fr 1.6fr;
    gap: 16px;
    padding: 22px 30px 26px;
  }

  .panel {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 18px 22px;
    box-shadow: 0 1px 3px rgba(0,0,0,.04);
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--orange-icon);
    margin-bottom: 14px;
  }
  .panel-header .fa-star { color: var(--orange-icon); }

  .motivation-heading {
    font-family: 'Permanent Marker', cursive;
    font-size: 28px;
    line-height: 1.1;
    color: #1a1a1a;
    text-align: center;
    margin: 4px 0 14px;
  }

  .motivation-sub {
    text-align: center;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    color: #555;
    line-height: 1.5;
    margin-bottom: 14px;
  }

  .motivation-cta {
    text-align: center;
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    color: var(--orange-icon);
    letter-spacing: 2px;
    font-size: 18px;
  }

  .hands {
    margin-top: 16px;
    text-align: center;
    color: #f5c6a8;
    font-size: 26px;
    letter-spacing: 6px;
  }

  .scorecard-icons {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
    justify-items: center;
    margin-bottom: 16px;
  }

  .mini-icon {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 22px;
    box-shadow: 0 2px 6px rgba(0,0,0,.1);
  }

  .scorecard-rings {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
    justify-items: center;
  }

  .ring {
    width: 76px;
    height: 76px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  .ring-value {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 16px;
    color: #222;
    position: relative;
    z-index: 1;
  }
  .ring-label {
    font-family: 'Oswald', sans-serif;
    font-weight: 600;
    text-align: center;
    font-size: 10.5px;
    letter-spacing: 0.5px;
    margin-top: 6px;
    color: #444;
    line-height: 1.15;
    text-transform: uppercase;
  }

  .ring-wrap { display: flex; flex-direction: column; align-items: center; gap: 0; }

  .footer {
    background: var(--footer-dark);
    color: #fff;
    padding: 18px 30px;
    text-align: center;
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 20px;
    letter-spacing: 2px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
  }
  .footer i.fa-trophy { color: var(--orange-icon); font-size: 22px; }
  .footer .accent { color: var(--orange-icon); }

  @media (max-width: 980px) {
    .metrics, .banners { grid-template-columns: repeat(3, 1fr); }
    .bottom-grid { grid-template-columns: 1fr; }
    .title-row { grid-template-columns: 1fr; }
    .title-row h1 { font-size: 38px; }
    .info-box { min-width: 0; }
  }
  @media (max-width: 620px) {
    .metrics, .banners, .scorecard-icons, .scorecard-rings { grid-template-columns: repeat(2, 1fr); }
    .top-bar { grid-template-columns: 80px 1fr 80px; padding: 12px 16px; }
    .brand { font-size: 24px; }
    .dspr  { font-size: 22px; }
  }
</style>
</head>
<body>

<div class="dashboard">

  <div class="top-bar">
    <div class="logo-placeholder">CAESAR<br>LOGO</div>
    <div class="brand">PNE PIZZA</div>
    <div class="dspr">DSPR</div>
  </div>

  <div class="title-row">
    <div>
      <h1>DAILY STORE PERFORMANCE</h1>
      <div class="tagline">FOCUS. EXECUTE. DELIVER. REPEAT.</div>
    </div>
    <div class="info-box">
      <div class="info-row">
        <div class="info-label">STORE</div>
        <div class="info-value" id="storeId">—</div>
      </div>
      <div class="info-row">
        <div class="info-label">DATE</div>
        <div class="info-value" id="dateValue">—</div>
      </div>
    </div>
  </div>

  <div class="metrics" id="metrics"></div>

  <div class="banners" id="banners"></div>

  <div class="bottom-grid">

    <div class="panel">
      <div class="panel-header">
        <i class="fas fa-star"></i><span>STORE MOTIVATION</span>
      </div>
      <div class="motivation-heading">Great Teamwork<br>Drives Great Results!</div>
      <div class="motivation-sub">
        Keep up the energy, stay focused on the details,<br>
        and let's hit every goal, every day!
      </div>
      <div class="motivation-cta">WE WIN TOGETHER!</div>
      <div class="hands">
        <i class="far fa-hand-paper"></i>
        <i class="far fa-hand-paper"></i>
        <i class="far fa-hand-paper"></i>
        <i class="far fa-hand-paper"></i>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header" style="justify-content:center;">
        <i class="fas fa-star"></i><span>TODAY'S SCORECARD SUMMARY</span>
      </div>
      <div class="scorecard-icons" id="scorecardIcons"></div>
      <div class="scorecard-rings" id="scorecardRings"></div>
    </div>
  </div>

  <div class="footer">
    <i class="fas fa-trophy"></i>
    <span>CHAMPIONS <span class="accent">FOCUS ON THE FIVE.</span> WIN EVERY DAY!</span>
  </div>
</div>

<script>
/* ---------- INJECTED DATA ---------- */
const REPORT = ${reportJson};
const metrics = REPORT.metrics;

/* ---------- HEADER ---------- */
document.getElementById('storeId').textContent = REPORT.storeId;
document.getElementById('dateValue').textContent = REPORT.date;

const NO_DATA = '<span class="nodata">No data</span>';

/* ---------- METRIC CARDS ---------- */
const metricsEl = document.getElementById('metrics');
metrics.forEach(m => {
  let bottomHtml = '';
  if (m.bottomType === 'gauge') {
    if (m.bottomValue == null) {
      bottomHtml = '<div class="metric-sub-label">% OF GOAL</div><div style="margin-top:10px;">' + NO_DATA + '</div>';
    } else {
      const pct = Math.max(0, Math.min(100, m.bottomValue));
      const gaugeColor = 'var(--' + (m.color === 'orange' ? 'orange-icon' : m.color) + ')';
      bottomHtml =
        '<div class="metric-sub-label">' + (m.key === 'score' ? '% OF MAX' : '% OF GOAL') + '</div>' +
        '<div class="gauge">' + buildGauge(pct, gaugeColor) +
        '<div class="gauge-value">' + m.bottomValue.toFixed(2) + '%</div></div>';
    }
  } else { /* delta */
    if (m.bottomValue == null) {
      bottomHtml = '<div class="metric-trend-label">VS GOAL</div><div style="margin-top:6px;">' + NO_DATA + '</div>';
    } else if (m.bottomValue >= 0) {
      bottomHtml =
        '<div class="metric-trend-label">TREND</div>' +
        '<div class="trend-up">UP ' + m.bottomValue.toFixed(2) + '% <i class="fa-solid fa-arrow-up"></i></div>';
    } else {
      bottomHtml =
        '<div class="metric-sub-label">GAP TO GOAL</div>' +
        '<div class="trend-down" style="margin-top:6px;">' + m.bottomValue.toFixed(2) + '%</div>';
    }
  }

  const valueHtml = m.value == null ? NO_DATA : m.value;
  const goalHtml = m.goal == null ? NO_DATA : m.goal;

  metricsEl.insertAdjacentHTML('beforeend',
    '<div class="metric">' +
      '<div class="metric-icon ic-' + m.color + '"><i class="' + m.icon + '"></i></div>' +
      '<div class="metric-title t-' + m.color + '">' + m.title + '</div>' +
      '<div class="metric-value">' + valueHtml + '</div>' +
      '<div class="metric-sub-label">' + m.goalLabel + '</div>' +
      '<div class="metric-sub-value">' + goalHtml + '</div>' +
      bottomHtml +
    '</div>');
});

/* ---------- STATUS BANNERS ---------- */
const bannersEl = document.getElementById('banners');
metrics.forEach(m => {
  const isNoData = m.value == null;
  const cls = isNoData ? 'b-gray' : 'b-' + m.color;
  bannersEl.insertAdjacentHTML('beforeend',
    '<div class="banner ' + cls + '">' +
      '<i class="' + m.banner.icon + '"></i>' +
      '<div class="banner-text">' +
        '<div>' + m.banner.big + '</div>' +
        '<div style="font-weight:600; opacity:.95; margin-top:3px;">' + m.banner.small + '</div>' +
      '</div>' +
    '</div>');
});

/* ---------- SCORECARD ICONS ---------- */
const iconsEl = document.getElementById('scorecardIcons');
metrics.forEach(m => {
  iconsEl.insertAdjacentHTML('beforeend',
    '<div class="mini-icon ic-' + m.color + '"><i class="' + m.icon + '"></i></div>');
});

/* ---------- SCORECARD RINGS ---------- */
const ringsEl = document.getElementById('scorecardRings');
const ringLabels = {
  sales:   'TOTAL SALES',
  score:   'STORE SCORE',
  portal:  'PUT INTO PORTAL',
  ontime:  'IN PORTAL ON TIME',
  hnr:     'HNR PROMISE MET %'
};
metrics.forEach(m => {
  const colorVar = 'var(--' + (m.color === 'orange' ? 'orange-icon' : m.color) + ')';
  const pct = m.rawValue == null ? 0 : Math.max(0, Math.min(100, m.rawValue));
  const centerHtml = m.rawValue == null ? NO_DATA : (m.rawValue.toFixed(2) + '%');
  ringsEl.insertAdjacentHTML('beforeend',
    '<div class="ring-wrap">' +
      '<div class="ring">' + buildRing(pct, colorVar) +
        '<div class="ring-value">' + centerHtml + '</div></div>' +
      '<div class="ring-label">' + (ringLabels[m.key] || '') + '</div>' +
    '</div>');
});

/* ---------- HELPERS ---------- */
function buildGauge(pct, color) {
  const r = 50;
  const circumference = Math.PI * r;
  const filled = (pct / 100) * circumference;
  return '' +
    '<svg viewBox="0 0 130 70">' +
      '<path d="M 15 60 A 50 50 0 0 1 115 60" fill="none" stroke="#dcdcdc" stroke-width="13" stroke-linecap="round"/>' +
      '<path d="M 15 60 A 50 50 0 0 1 115 60" fill="none" stroke="' + color + '" stroke-width="13" stroke-linecap="round" stroke-dasharray="' + filled + ' ' + circumference + '"/>' +
    '</svg>';
}

function buildRing(pct, color) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return '' +
    '<svg viewBox="0 0 76 76" width="76" height="76">' +
      '<circle cx="38" cy="38" r="' + r + '" stroke="#e9e9e9" stroke-width="6" fill="none"/>' +
      '<circle cx="38" cy="38" r="' + r + '" stroke="' + color + '" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + offset + '"/>' +
    '</svg>';
}
</script>
</body>
</html>`;
