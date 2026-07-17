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

/**
 * Where a card's comparison baseline came from:
 *  - "goal"     — a real target from goal_metrics / store_score
 *  - "fallback" — no real goal; comparing against a real historical baseline
 *                 (week-to-date average, or "goals on track" for Store Score)
 *  - "none"     — nothing to compare against at all
 */
type ComparisonMode = "goal" | "fallback" | "none";

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
  /** Label shown for the ring in the scorecard summary (e.g. "TOTAL SALES"). */
  ringLabel: string;
  goalLabel: string;
  /** Formatted goal/baseline (e.g. "$1,200" or "75.00%"), or null when nothing to show. */
  goal: string | null;
  /** "gauge" (% of goal/avg) | "delta" (actual − goal/avg). */
  bottomType: "gauge" | "delta";
  /** For gauge: the % number. For delta: the point difference. null → No data. */
  bottomValue: number | null;
  /** Small heading shown above the gauge/delta value (e.g. "% OF GOAL", "VS WTD AVG"). */
  bottomSubLabel: string;
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

/**
 * Banner tone derived from performance vs the effective baseline (goal or
 * fallback) — never fabricates numbers, and never claims a target was hit
 * when there wasn't one to compare against.
 */
function bannerFor(
  status: "met" | "close" | "behind" | "nodata",
  mode: "goal" | "fallback",
): { icon: string; big: string; small: string } {
  if (status === "nodata") {
    return { icon: "fa-solid fa-circle-info", big: "NO DATA", small: "NOT AVAILABLE TODAY" };
  }
  if (status === "met") {
    return { icon: "fa-solid fa-trophy", big: "GREAT JOB!", small: "KEEP IT UP!" };
  }
  if (mode === "goal") {
    if (status === "close") {
      return { icon: "fa-solid fa-bolt", big: "ALMOST THERE!", small: "PUSH TO THE GOAL!" };
    }
    return { icon: "fa-solid fa-bullseye", big: "FOCUS AREA", small: "LET'S HIT THAT TARGET!" };
  }
  if (status === "close") {
    return { icon: "fa-solid fa-bolt", big: "ALMOST THERE!", small: "CLOSE TO YOUR AVERAGE!" };
  }
  return { icon: "fa-solid fa-chart-line", big: "BELOW AVERAGE", small: "LET'S BOUNCE BACK!" };
}

/** Status comparing an actual value to a baseline (goal or fallback), same units. */
function pctStatus(actual: number | null, baseline: number | null): "met" | "close" | "behind" | "nodata" {
  if (actual == null || baseline == null) return "nodata";
  if (actual >= baseline) return "met";
  if (actual >= baseline * 0.8) return "close";
  return "behind";
}

/** Mean of a date→amount map's values, optionally excluding one date key. */
function weekAverage(map: Record<string, number> | undefined, excludeDate?: string): number | null {
  if (!map) return null;
  const values = Object.entries(map)
    .filter(([d]) => d !== excludeDate)
    .map(([, v]) => v);
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/* ── Metric builders ────────────────────────────────────────────────────────── */

const fmtScore = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));

function buildMetrics(data: DsprResponse): ReportMetric[] {
  const { sales, day, goal_metrics, store_score, filtering } = data;

  /* (1) Total Sales — daily value = that day's total.
   * Goal = weekly goal / 7. Fallback = average of this week's other days,
   * or the previous week's average if this is the first day of the week. */
  const dailySales = sales?.this_week_by_day?.[filtering.date] ?? null;
  const weeklySalesGoal = goalValueByName(goal_metrics, (n) => n.includes("sales"));
  let salesBaseline: number | null = null;
  let salesMode: ComparisonMode = "none";
  if (weeklySalesGoal != null) {
    salesBaseline = weeklySalesGoal / 7;
    salesMode = "goal";
  } else {
    const fallback =
      weekAverage(sales?.this_week_by_day, filtering.date) ?? weekAverage(sales?.previous_week_by_day);
    if (fallback != null) {
      salesBaseline = fallback;
      salesMode = "fallback";
    }
  }
  const salesPct =
    dailySales != null && salesBaseline != null && salesBaseline > 0
      ? (dailySales / salesBaseline) * 100
      : null;
  const salesStatus = pctStatus(dailySales, salesBaseline);
  const salesHasRealGoal = salesMode === "goal";
  const salesMetRealGoal = salesHasRealGoal && salesStatus === "met";

  /* (2) Put Into Portal — daily. Fallback = week-to-date average. */
  const portalVal = day?.portal?.put_into_portal_percent ?? null;
  const portalGoal = goalValueByName(
    goal_metrics,
    (n) => n.includes("portal") && (n.includes("put") || n.includes("into")),
  );
  const portalWtdAvg = day?.portal?.week_to_date_avg?.put_into_portal_percent ?? null;
  const portalBaseline = portalGoal ?? portalWtdAvg;
  const portalMode: ComparisonMode = portalGoal != null ? "goal" : portalWtdAvg != null ? "fallback" : "none";
  const portalStatus = pctStatus(portalVal, portalBaseline);
  const portalHasRealGoal = portalMode === "goal";
  const portalMetRealGoal = portalHasRealGoal && portalStatus === "met";

  /* (3) In Portal On Time — daily. Fallback = week-to-date average. */
  const onTimeVal = day?.portal?.in_portal_on_time_percent ?? null;
  const onTimeGoal = goalValueByName(
    goal_metrics,
    (n) => n.includes("on-time") || n.includes("on time") || (n.includes("portal") && n.includes("time")),
  );
  const onTimeWtdAvg = day?.portal?.week_to_date_avg?.in_portal_on_time_percent ?? null;
  const onTimeBaseline = onTimeGoal ?? onTimeWtdAvg;
  const onTimeMode: ComparisonMode = onTimeGoal != null ? "goal" : onTimeWtdAvg != null ? "fallback" : "none";
  const onTimeStatus = pctStatus(onTimeVal, onTimeBaseline);
  const onTimeHasRealGoal = onTimeMode === "goal";
  const onTimeMetRealGoal = onTimeHasRealGoal && onTimeStatus === "met";

  /* (4) HNR Promise Met — daily. Fallback = week-to-date average. */
  const hnrVal = day?.hnr?.hnr_promise_met_percent ?? null;
  const hnrGoal = goalValueByName(goal_metrics, (n) => n.includes("hnr") || n.includes("promise"));
  const hnrWtdAvg = day?.hnr_week_to_date_avg?.hnr_promise_met_percent ?? null;
  const hnrBaseline = hnrGoal ?? hnrWtdAvg;
  const hnrMode: ComparisonMode = hnrGoal != null ? "goal" : hnrWtdAvg != null ? "fallback" : "none";
  const hnrStatus = pctStatus(hnrVal, hnrBaseline);
  const hnrHasRealGoal = hnrMode === "goal";
  const hnrMetRealGoal = hnrHasRealGoal && hnrStatus === "met";

  /* (5) Store Score — overall store_score.score out of its max points.
   * Fallback (no store_score): "Goals On Track" tally across the 4 metrics
   * above that have a real goal — never invents a score. */
  const scoreMax = store_score
    ? store_score.details?.reduce((s, d) => s + d.max, 0) || 100
    : null;
  const scoreVal = store_score?.score ?? null;

  const realGoalFlags = [salesHasRealGoal, portalHasRealGoal, onTimeHasRealGoal, hnrHasRealGoal];
  const metGoalFlags = [salesMetRealGoal, portalMetRealGoal, onTimeMetRealGoal, hnrMetRealGoal];
  const hasGoalCount = realGoalFlags.filter(Boolean).length;
  const metGoalCount = metGoalFlags.filter((m, i) => realGoalFlags[i] && m).length;
  const onTrackPct = hasGoalCount > 0 ? (metGoalCount / hasGoalCount) * 100 : null;

  const scorePct =
    scoreVal != null && scoreMax != null && scoreMax > 0 ? (scoreVal / scoreMax) * 100 : null;

  const scoreHasRealScore = scoreVal != null && scoreMax != null;
  const scoreMode: ComparisonMode = scoreHasRealScore ? "goal" : hasGoalCount > 0 ? "fallback" : "none";
  const scoreStatus = scoreHasRealScore
    ? pctStatus(scoreVal, scoreMax)
    : pctStatus(onTrackPct, onTrackPct != null ? 100 : null);

  return [
    {
      key: "sales",
      num: 1,
      title: "1. TOTAL SALES",
      icon: "fa-solid fa-dollar-sign",
      color: "green",
      ringLabel: "TOTAL SALES",
      value: dailySales != null ? fmtMoney2(dailySales) : null,
      rawValue: salesPct != null ? Math.min(salesPct, 100) : null,
      goalLabel: salesMode === "fallback" ? "WTD AVG" : "DAILY GOAL",
      goal: salesBaseline != null ? fmtMoney0(salesBaseline) : null,
      bottomType: "gauge",
      bottomValue: salesPct,
      bottomSubLabel: salesMode === "fallback" ? "% OF WTD AVG" : "% OF GOAL",
      banner: bannerFor(salesStatus, salesMode === "fallback" ? "fallback" : "goal"),
    },
    {
      key: "score",
      num: 2,
      title: scoreHasRealScore
        ? store_score?.label
          ? `2. STORE SCORE — ${store_score.label.toUpperCase()}`
          : "2. STORE SCORE"
        : hasGoalCount > 0
          ? "2. GOALS ON TRACK"
          : "2. STORE SCORE",
      icon: "fa-solid fa-star",
      color: "blue",
      ringLabel: scoreHasRealScore ? "STORE SCORE" : "GOALS ON TRACK",
      value: scoreHasRealScore ? fmtScore(scoreVal as number) : hasGoalCount > 0 ? String(metGoalCount) : null,
      rawValue: scoreHasRealScore
        ? scorePct != null
          ? Math.min(scorePct, 100)
          : null
        : onTrackPct != null
          ? Math.min(onTrackPct, 100)
          : null,
      goalLabel: "OUT OF",
      goal: scoreHasRealScore
        ? scoreMax != null
          ? `${fmtScore(scoreMax)} PTS`
          : null
        : hasGoalCount > 0
          ? `${hasGoalCount} GOALS`
          : null,
      bottomType: "gauge",
      bottomValue: scoreHasRealScore ? scorePct : onTrackPct,
      bottomSubLabel: scoreHasRealScore ? "% OF MAX" : "% ON TRACK",
      banner: bannerFor(scoreStatus, scoreMode === "fallback" ? "fallback" : "goal"),
    },
    {
      key: "portal",
      num: 3,
      title: "3. PUT INTO PORTAL",
      icon: "fa-solid fa-display",
      color: "purple",
      ringLabel: "PUT INTO PORTAL",
      value: portalVal != null ? fmtPct2(portalVal) : null,
      rawValue: portalVal != null ? Math.min(portalVal, 100) : null,
      goalLabel: portalMode === "fallback" ? "WTD AVG" : "DAILY GOAL",
      goal: portalBaseline != null ? fmtPct2(portalBaseline) : null,
      bottomType: "delta",
      bottomValue: portalVal != null && portalBaseline != null ? portalVal - portalBaseline : null,
      bottomSubLabel: portalMode === "fallback" ? "VS WTD AVG" : "VS GOAL",
      banner: bannerFor(portalStatus, portalMode === "fallback" ? "fallback" : "goal"),
    },
    {
      key: "ontime",
      num: 4,
      title: "4. IN PORTAL ON TIME",
      icon: "fa-regular fa-clock",
      color: "orange",
      ringLabel: "IN PORTAL ON TIME",
      value: onTimeVal != null ? fmtPct2(onTimeVal) : null,
      rawValue: onTimeVal != null ? Math.min(onTimeVal, 100) : null,
      goalLabel: onTimeMode === "fallback" ? "WTD AVG" : "DAILY GOAL",
      goal: onTimeBaseline != null ? fmtPct2(onTimeBaseline) : null,
      bottomType: "delta",
      bottomValue: onTimeVal != null && onTimeBaseline != null ? onTimeVal - onTimeBaseline : null,
      bottomSubLabel: onTimeMode === "fallback" ? "VS WTD AVG" : "VS GOAL",
      banner: bannerFor(onTimeStatus, onTimeMode === "fallback" ? "fallback" : "goal"),
    },
    {
      key: "hnr",
      num: 5,
      title: "5. HNR PROMISE MET %",
      icon: "fa-solid fa-bullseye",
      color: "red",
      ringLabel: "HNR PROMISE MET %",
      value: hnrVal != null ? fmtPct2(hnrVal) : null,
      rawValue: hnrVal != null ? Math.min(hnrVal, 100) : null,
      goalLabel: hnrMode === "fallback" ? "WTD AVG" : "DAILY GOAL",
      goal: hnrBaseline != null ? fmtPct2(hnrBaseline) : null,
      bottomType: "delta",
      bottomValue: hnrVal != null && hnrBaseline != null ? hnrVal - hnrBaseline : null,
      bottomSubLabel: hnrMode === "fallback" ? "VS WTD AVG" : "VS GOAL",
      banner: bannerFor(hnrStatus, hnrMode === "fallback" ? "fallback" : "goal"),
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

const REPORT_LOGO_DATA_URI = "data:image/png;base64,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";

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

  .logo-badge {
    width: 84px;
    height: 84px;
    background: #ffffff;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    margin-top: -10px;
    margin-bottom: -24px;
    position: relative;
    z-index: 2;
    box-shadow: 0 2px 8px rgba(0,0,0,.15);
  }
  .logo-badge img {
    width: 100%;
    height: 100%;
    object-fit: contain;
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
    <div class="logo-badge"><img src="${REPORT_LOGO_DATA_URI}" alt="Store logo" /></div>
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
      bottomHtml = '<div class="metric-sub-label">' + m.bottomSubLabel + '</div><div style="margin-top:10px;">' + NO_DATA + '</div>';
    } else {
      const pct = Math.max(0, Math.min(100, m.bottomValue));
      const gaugeColor = 'var(--' + (m.color === 'orange' ? 'orange-icon' : m.color) + ')';
      bottomHtml =
        '<div class="metric-sub-label">' + m.bottomSubLabel + '</div>' +
        '<div class="gauge">' + buildGauge(pct, gaugeColor) +
        '<div class="gauge-value">' + m.bottomValue.toFixed(2) + '%</div></div>';
    }
  } else { /* delta */
    if (m.bottomValue == null) {
      bottomHtml = '<div class="metric-trend-label">' + m.bottomSubLabel + '</div><div style="margin-top:6px;">' + NO_DATA + '</div>';
    } else if (m.bottomValue >= 0) {
      bottomHtml =
        '<div class="metric-trend-label">' + m.bottomSubLabel + '</div>' +
        '<div class="trend-up">UP ' + m.bottomValue.toFixed(2) + '% <i class="fa-solid fa-arrow-up"></i></div>';
    } else {
      bottomHtml =
        '<div class="metric-sub-label">' + m.bottomSubLabel + '</div>' +
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
metrics.forEach(m => {
  const colorVar = 'var(--' + (m.color === 'orange' ? 'orange-icon' : m.color) + ')';
  const pct = m.rawValue == null ? 0 : Math.max(0, Math.min(100, m.rawValue));
  const centerHtml = m.rawValue == null ? NO_DATA : (m.rawValue.toFixed(2) + '%');
  ringsEl.insertAdjacentHTML('beforeend',
    '<div class="ring-wrap">' +
      '<div class="ring">' + buildRing(pct, colorVar) +
        '<div class="ring-value">' + centerHtml + '</div></div>' +
      '<div class="ring-label">' + (m.ringLabel || '') + '</div>' +
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
