import { format } from "date-fns";
import type { DsprResponse } from "@/types/dspr.types";
import type { CustomerService } from "@/types/dashboard-report.types";
import type { WbrComplaint, WbrFeedback } from "@/types/hooks.types";
import {
  STORE_ICON_SVG,
  TIPS_ICON_SVG,
  CUSTOMER_SERVICE_ICON_SVG,
  CUSTOMER_FEEDBACK_ICON_SVG,
  CUSTOMER_COMPLAINT_ICON_SVG,
  HNR_ICON_SVG,
  PORTAL_ICON_SVG,
  HERO_MASCOT_SVG,
  NEWS_ICON_SVG,
} from "./store-performance-report-icons";

/* ──────────────────────────────────────────────────────────────────────────
 *  buildStorePerformanceReportHtml — renders the "Daily Store Performance"
 *  one-pager (tips, guest service, feedback/complaints, HNR, portal, and the
 *  manager-entered "Yesterday Hero" employee-of-the-day photo) as a self-
 *  contained HTML document string, in the same iframe + html2canvas capture
 *  flow as buildDsprReportHtml.
 *
 *  Tips/HNR/portal/guest-service/feedback/complaint values all come from data
 *  already loaded for the live dashboard — nothing is fabricated. The
 *  employee name/photo and the footer sentence are manager-entered per
 *  generation (collected by StorePerformanceReportDialog) rather than pulled
 *  from any stored field.
 *
 *  All icons are the real Figma SVGs (store-performance-report-icons.ts) —
 *  inlined directly so they stay crisp under html2canvas and never depend on
 *  an external asset load.
 * ────────────────────────────────────────────────────────────────────────── */

export interface StorePerformanceReportInput {
  data: DsprResponse;
  storeId: string;
  /** wbrData?.["customer-service"] */
  guestService?: CustomerService;
  /** hooksWbr.data?.complaints */
  complaints?: WbrComplaint[];
  /** hooksWbr.data?.feedbacks */
  feedbacks?: WbrFeedback[];
  /** "Yesterday Hero" — employee of the day, entered fresh per report. */
  employeeName: string;
  /** Data URL from the dialog's client-side file read, or null for the initial-letter fallback. */
  employeeImageDataUrl?: string | null;
  /** Manager-picked preset or custom sentence (already trimmed/capped by the dialog). */
  footerMessage: string;
}

/** Hard cap on the footer sentence, shared with the dialog so its input and this render never disagree. */
export const FOOTER_MESSAGE_MAX_LENGTH = 150;

/** Preset footer sentences offered in the dialog — generic and positive, no per-store data needed. */
export const FOOTER_MESSAGE_PRESETS: string[] = [
  "Every great day starts with a great team — thank you for the hard work and hospitality!",
  "Great things are happening here — keep up the amazing teamwork!",
  "Proud of this crew — thank you for taking care of our guests today.",
  "Small moments, big impact — thank you for showing up and showing out today.",
  "Your hustle doesn't go unnoticed — thank you for another great day.",
];

const NO_DATA = `<span class="nodata">No data</span>`;

/** Escape a string for safe embedding in HTML text nodes / attributes. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const fmtMoney0 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPct1 = (n: number) => `${n.toFixed(1)}%`;

/** Mean of guest_service across entries, skipping nulls. Null if none present. */
function averageGuestService(cs: CustomerService | undefined): number | null {
  const values = (cs?.entries ?? [])
    .map((e) => e.guest_service)
    .filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** "3 logged this week" / "No complaints this week" / null (→ No data) when the count itself is missing. */
function weeklyCountLabel(count: number | undefined, noun: string, verb: string): string | null {
  if (count == null) return null;
  if (count === 0) return `No ${noun} this week`;
  return `${count} ${noun} ${verb} this week`;
}

export function buildStorePerformanceReportHtml(
  input: StorePerformanceReportInput,
  selectedDate: Date,
): string {
  const {
    data,
    storeId,
    guestService,
    complaints,
    feedbacks,
    employeeName,
    employeeImageDataUrl,
    footerMessage,
  } = input;
  const { day } = data;

  const tips = day?.total_tips ?? null;
  const guestServicePct = averageGuestService(guestService);
  const feedbackLabel = weeklyCountLabel(feedbacks?.length, "feedback entries", "submitted");
  const complaintLabel = weeklyCountLabel(complaints?.length, "complaints", "logged");

  const hnrToday = day?.hnr?.hnr_promise_met_percent ?? null;
  const hnrWtdAvg = day?.hnr_week_to_date_avg?.hnr_promise_met_percent ?? null;

  const portalToday = day?.portal?.put_into_portal_percent ?? null;
  const portalWtdAvg = day?.portal?.week_to_date_avg?.put_into_portal_percent ?? null;

  const employeeInitial = employeeName.trim().charAt(0).toUpperCase() || "?";

  const avatarHtml = employeeImageDataUrl
    ? `<img class="hero-avatar" src="${esc(employeeImageDataUrl)}" alt="${esc(employeeName)}" />`
    : `<div class="hero-avatar hero-avatar--fallback">${esc(employeeInitial)}</div>`;

  const safeFooterMessage = footerMessage.slice(0, FOOTER_MESSAGE_MAX_LENGTH);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PNE Pizza — Daily Store Performance</title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

<style>
  :root {
    --orange: #ED680F;
    --orange-dark: #c8551f;
    --cream: #F7F2EC;
    --text-dark: #1a1a1a;
    --text-muted: #6c6c6c;
    --black-bar: #101010;
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
    background: #ffffff;
    box-shadow: 0 4px 22px rgba(0,0,0,.08);
    overflow: hidden;
  }

  .top-bar {
    background: var(--orange);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 28px 40px;
  }

  .top-bar .title {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 34px;
    letter-spacing: .5px;
    text-transform: uppercase;
  }

  .top-bar .meta {
    display: flex;
    gap: 28px;
    margin-top: 10px;
    font-family: 'Oswald', sans-serif;
    font-size: 18px;
    font-weight: 500;
  }
  .top-bar .meta b { font-weight: 700; margin-right: 6px; }

  .logo-badge {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-badge svg { display: block; width: 150px; height: auto; }

  .body {
    display: flex;
    gap: 32px;
    padding: 28px 36px;
    flex-wrap: wrap;
  }

  .col-main { flex: 1 1 0; min-width: 480px; display: flex; flex-direction: column; gap: 18px; }
  .col-side { flex: 0 0 280px; display: flex; flex-direction: column; align-items: center; gap: 18px; }

  .tips-pill {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 16px;
    background: var(--cream);
    border-radius: 20px;
    padding: 14px 28px;
  }
  .tips-icon { flex-shrink: 0; display: flex; align-items: center; }
  .tips-icon svg { display: block; width: 64px; height: auto; }
  .tips-pill .label { font-family: 'Oswald', sans-serif; font-weight: 700; color: var(--orange); font-size: 20px; text-transform: uppercase; }
  .tips-pill .value { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 34px; color: var(--orange); }

  .row {
    display: flex;
    align-items: stretch;
    background: var(--orange);
    border-radius: 20px;
    padding: 10px;
    gap: 16px;
  }
  .row .row-label {
    flex: 0 0 220px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 20px;
    color: #fff;
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 18px;
    text-transform: uppercase;
  }
  .row-icon { flex-shrink: 0; display: flex; align-items: center; }
  .row-icon svg { display: block; height: 32px; width: auto; }
  .row .row-value {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: var(--cream);
    border-radius: 16px;
    padding: 14px 20px;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 18px;
  }
  .row .row-value .headline { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 26px; display: block; }

  .black-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--black-bar);
    color: #fff;
    border-radius: 20px;
    padding: 18px 28px;
    gap: 24px;
  }
  .black-bar .bar-title {
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 22px;
    text-transform: uppercase;
  }
  .bar-icon { flex-shrink: 0; display: flex; align-items: center; }
  .bar-icon svg { display: block; height: 34px; width: auto; }
  .black-bar .stats { display: flex; gap: 32px; }
  .black-bar .stat { text-align: center; }
  .black-bar .stat .stat-label { color: var(--orange); font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 14px; text-transform: uppercase; }
  .black-bar .stat .stat-value { font-size: 22px; font-weight: 500; }

  .hero-mascot { display: flex; align-items: center; justify-content: center; }
  .hero-mascot svg { display: block; width: 170px; height: auto; }
  .hero-label {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: .5px;
    text-transform: uppercase;
    color: var(--orange);
    text-align: center;
  }
  .hero-avatar {
    width: 220px; height: 220px;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 2px 10px rgba(0,0,0,.15);
  }
  .hero-avatar--fallback {
    display: flex; align-items: center; justify-content: center;
    background: var(--orange);
    color: #fff;
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 84px;
  }
  .hero-name {
    font-family: 'Oswald', sans-serif;
    font-weight: 700;
    font-size: 28px;
    text-transform: capitalize;
    text-align: center;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 26px 48px 40px;
  }
  .footer-icon { flex-shrink: 0; display: flex; align-items: center; }
  .footer-icon svg { display: block; width: 72px; height: auto; }
  .footer-text {
    flex: 0 1 700px;
    text-align: left;
    font-family: 'Inter', sans-serif;
    font-size: 20px;
    font-weight: 500;
    color: var(--text-dark);
  }

  .nodata { color: var(--text-muted); font-size: 14px; font-weight: 400; }

  @media (max-width: 900px) {
    .body { flex-direction: column; }
    .col-side { flex: 1 1 auto; align-self: center; }
    .row { flex-wrap: wrap; }
    .footer { flex-direction: column; text-align: center; }
    .footer-text { text-align: center; }
  }
</style>
</head>
<body>
<div class="dashboard">

  <div class="top-bar">
    <div>
      <div class="title">Daily Store Performance</div>
      <div class="meta">
        <div><b>Store</b>${esc(storeId)}</div>
        <div><b>Date</b>${esc(format(selectedDate, "EEEE, MMMM d"))}</div>
      </div>
    </div>
    <div class="logo-badge">${STORE_ICON_SVG}</div>
  </div>

  <div class="body">
    <div class="col-main">
      <div class="tips-pill">
        <div class="tips-icon">${TIPS_ICON_SVG}</div>
        <div>
          <div class="label">Total Tips</div>
          <div class="value">${tips != null ? fmtMoney0(tips) : NO_DATA}</div>
        </div>
      </div>

      <div class="row">
        <div class="row-label"><span class="row-icon">${CUSTOMER_SERVICE_ICON_SVG}</span>Customer Service</div>
        <div class="row-value">
          <div>
            Guest Service
            <span class="headline">${guestServicePct != null ? fmtPct1(guestServicePct) : NO_DATA}</span>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="row-label"><span class="row-icon">${CUSTOMER_FEEDBACK_ICON_SVG}</span>Customer Feedback</div>
        <div class="row-value">${feedbackLabel != null ? esc(feedbackLabel) : NO_DATA}</div>
      </div>

      <div class="row">
        <div class="row-label"><span class="row-icon">${CUSTOMER_COMPLAINT_ICON_SVG}</span>Customer Complaint</div>
        <div class="row-value">${complaintLabel != null ? esc(complaintLabel) : NO_DATA}</div>
      </div>

      <div class="black-bar">
        <div class="bar-title"><span class="bar-icon">${HNR_ICON_SVG}</span>HNR</div>
        <div class="stats">
          <div class="stat">
            <div class="stat-label">Today</div>
            <div class="stat-value">${hnrToday != null ? fmtPct1(hnrToday) : NO_DATA}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Week-to-Date Avg</div>
            <div class="stat-value">${hnrWtdAvg != null ? fmtPct1(hnrWtdAvg) : NO_DATA}</div>
          </div>
        </div>
      </div>

      <div class="black-bar">
        <div class="bar-title"><span class="bar-icon">${PORTAL_ICON_SVG}</span>Put Into Portal</div>
        <div class="stats">
          <div class="stat">
            <div class="stat-label">Today</div>
            <div class="stat-value">${portalToday != null ? fmtPct1(portalToday) : NO_DATA}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Week-to-Date Avg</div>
            <div class="stat-value">${portalWtdAvg != null ? fmtPct1(portalWtdAvg) : NO_DATA}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="col-side">
      <div class="hero-mascot">${HERO_MASCOT_SVG}</div>
      <div class="hero-label">Yesterday Hero</div>
      ${avatarHtml}
      <div class="hero-name">${esc(employeeName)}</div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-icon">${NEWS_ICON_SVG}</div>
    <div class="footer-text">${esc(safeFooterMessage)}</div>
  </div>

</div>
</body>
</html>`;

  return html;
}
