import { format } from "date-fns";
import type { DsprResponse } from "@/types/dspr.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  buildDsprDailyReportHtml — renders the friendly "DSPR REPORT" one-pager
 *  (day-level HnR Special, Portal + derived Customer Service, Total Tips,
 *  plus the manager-entered "Employee of the Day" photo and a footer quote)
 *  as a self-contained HTML document string, captured via the same
 *  iframe + html2canvas flow as the other DSPR report screenshots.
 *
 *  All KPI values come from data already loaded for the live dashboard for
 *  the currently selected day — nothing is fabricated. "Customer Service" is
 *  not a stored field: it's the average of the day's Into Portal % and
 *  On Time % (there is no other per-day guest-service metric this report
 *  draws on). The employee name/photo and the footer sentence are manager-
 *  entered per generation (collected by DsprDailyReportDialog).
 *
 *  Icons are inline stroke SVGs with hard-coded colors — html2canvas
 *  rasterizes each <svg> in isolation, so `currentColor` would not resolve
 *  and every icon must carry its own explicit stroke/fill.
 * ────────────────────────────────────────────────────────────────────────── */

export interface DsprDailyReportInput {
  data: DsprResponse;
  storeId: string;
  /** Employee of the Day — entered fresh per report. */
  employeeName: string;
  /** Data URL from the dialog's client-side file read, or null for the initial-letter fallback. */
  employeeImageDataUrl?: string | null;
  /** Manager-picked preset or custom sentence (already trimmed/capped by the dialog). */
  footerMessage: string;
}

const NO_DATA = `<span class="nodata">No data</span>`;

/* ── Inline icons (lucide geometry, explicit colors for html2canvas) ─────── */
const ICON_PATHS = {
  trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
  flame: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>`,
  smile: `<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>`,
  coins: `<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>`,
  quote: `<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2h-1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H4a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>`,
} as const;

function icon(name: keyof typeof ICON_PATHS, color: string, size = 24): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${ICON_PATHS[name]}</svg>`;
}

/** Solid star — used as the celebratory accent next to the hero line. */
function starIcon(color: string, size = 18): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}

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
/** Percent sign gets its own span plus a hard space — Oswald's numerals sit
 * tight enough against a bare "%" that the two visually fuse otherwise. */
const fmtPct1 = (n: number) => `${n.toFixed(1)}&nbsp;<span class="pct-sign">%</span>`;

export function buildDsprDailyReportHtml(
  input: DsprDailyReportInput,
  selectedDate: Date,
): string {
  const { data, storeId, employeeName, employeeImageDataUrl, footerMessage } = input;
  const { day } = data;

  const hnrSpecial = day?.important_items_hnr ?? day?.hnr ?? null;
  const portal = day?.portal ?? null;
  const customerServicePct =
    portal != null
      ? (portal.put_into_portal_percent + portal.in_portal_on_time_percent) / 2
      : null;
  const tips = day?.total_tips ?? null;

  const trimmedName = employeeName.trim();
  const employeeInitial = trimmedName.charAt(0).toUpperCase() || "?";
  const firstName = trimmedName.split(/\s+/)[0] || trimmedName;

  const avatarHtml = employeeImageDataUrl
    ? `<img class="hero-avatar" src="${esc(employeeImageDataUrl)}" alt="${esc(trimmedName)}" />`
    : `<div class="hero-avatar hero-avatar--fallback">${esc(employeeInitial)}</div>`;

  // Employee of the Day is optional — when no name was picked, the hero band
  // is skipped entirely rather than showing an empty/placeholder card.
  const heroHtml = trimmedName
    ? `<div class="hero">
    <div class="hero-inner">
      ${avatarHtml}
      <div>
        <div class="hero-eyebrow">${icon("trophy", "#C8551F", 15)}Employee of the Day</div>
        <div class="hero-name">${esc(trimmedName)}</div>
        <div class="hero-praise">${starIcon("#ED680F", 18)}Amazing work${firstName ? `, ${esc(firstName)}` : ""}!</div>
        <div class="hero-sub">Thank you for setting the standard yesterday.</div>
      </div>
    </div>
  </div>`
    : "";

  const safeFooterMessage = footerMessage.slice(0, 150);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>DSPR Report</title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

<style>
  :root {
    --orange: #ED680F;
    --orange-deep: #C8551F;
    --orange-tint: #FFF3E9;
    --ink: #17181A;
    --muted: #6B7280;
    --hairline: #EBE7E2;

    --sky: #0284C7;
    --sky-tint: #E8F5FE;
    --violet: #7C3AED;
    --violet-tint: #F1ECFE;
    --rose: #E11D48;
    --rose-tint: #FEEBEF;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    background: #efefef;
    font-family: 'Inter', Arial, sans-serif;
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
  }

  .dashboard {
    width: 1180px;
    margin: 20px auto;
    background: #ffffff;
    box-shadow: 0 4px 22px rgba(0,0,0,.08);
    overflow: hidden;
  }

  /* ── Header ─────────────────────────────────────────────────────────── */
  .top-bar {
    background: var(--orange);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 26px 40px;
  }
  .brand { display: flex; align-items: center; gap: 18px; }
  .logo-badge {
    flex: 0 0 auto;
    width: 72px; height: 72px;
    border-radius: 18px;
    background: #fff;
    padding: 6px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .logo-badge img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .brand .title {
    font-family: 'Oswald', 'Arial Narrow', sans-serif;
    font-weight: 700;
    font-size: 38px;
    line-height: 1.05;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  .brand .subtitle {
    font-size: 13px;
    font-weight: 500;
    letter-spacing: .08em;
    text-transform: uppercase;
    opacity: .92;
    margin-top: 5px;
  }
  .head-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 7px; }
  .chip {
    background: rgba(255,255,255,.18);
    border: 1px solid rgba(255,255,255,.35);
    border-radius: 999px;
    padding: 6px 16px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: .02em;
    white-space: nowrap;
  }
  .chip .chip-key {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    opacity: .8;
    margin-right: 8px;
  }

  /* ── Employee of the Day ────────────────────────────────────────────── */
  .hero {
    background: var(--orange-tint);
    border-bottom: 1px solid var(--hairline);
    padding: 26px 40px;
    display: flex;
    justify-content: center;
  }
  .hero-inner { display: flex; align-items: center; gap: 26px; }
  .hero-avatar {
    width: 104px; height: 104px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--orange);
    box-shadow: 0 0 0 4px #fff, 0 0 0 7px rgba(237,104,15,.28);
  }
  .hero-avatar--fallback {
    display: flex; align-items: center; justify-content: center;
    color: #fff;
    font-family: 'Oswald', 'Arial Narrow', sans-serif;
    font-weight: 700;
    font-size: 44px;
  }
  .hero-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #fff;
    border: 1px solid rgba(237,104,15,.28);
    border-radius: 999px;
    padding: 5px 14px 5px 11px;
    color: var(--orange-deep);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .hero-eyebrow svg { display: block; }
  .hero-name {
    font-family: 'Oswald', 'Arial Narrow', sans-serif;
    font-weight: 700;
    font-size: 40px;
    line-height: 1.1;
    margin-top: 9px;
  }
  .hero-praise {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    color: var(--orange);
    font-size: 20px;
    font-weight: 700;
  }
  .hero-praise svg { display: block; }
  .hero-sub {
    margin-top: 3px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 500;
  }

  /* ── KPI cards ──────────────────────────────────────────────────────── */
  .kpis {
    display: flex;
    gap: 18px;
    padding: 30px 40px 26px;
  }
  /* No Employee of the Day hero band — give the KPI row its own breathing
   * room below the header instead of sitting flush against the orange bar. */
  .kpis--no-hero {
    padding-top: 40px;
    border-top: 1px solid var(--hairline);
  }
  .kpi-card {
    flex: 1 1 0;
    border-radius: 20px;
    padding: 20px 22px 18px;
    border: 1px solid transparent;
  }
  .kpi-card.sky    { background: var(--sky-tint);    border-color: rgba(2,132,199,.18); }
  .kpi-card.violet { background: var(--violet-tint); border-color: rgba(124,58,237,.18); }
  .kpi-card.rose   { background: var(--rose-tint);   border-color: rgba(225,29,72,.18); }

  .kpi-head { display: flex; align-items: center; gap: 11px; }
  .kpi-chip {
    flex: 0 0 auto;
    width: 40px; height: 40px;
    border-radius: 12px;
    background: #fff;
    display: flex; align-items: center; justify-content: center;
  }
  .kpi-chip svg { display: block; }
  .kpi-label {
    font-family: 'Oswald', 'Arial Narrow', sans-serif;
    font-weight: 600;
    font-size: 15px;
    letter-spacing: .1em;
    text-transform: uppercase;
  }
  .kpi-card.sky    .kpi-label { color: var(--sky); }
  .kpi-card.violet .kpi-label { color: var(--violet); }
  .kpi-card.rose   .kpi-label { color: var(--rose); }

  .kpi-value {
    font-family: 'Oswald', 'Arial Narrow', sans-serif;
    font-weight: 700;
    font-size: 48px;
    line-height: 1.05;
    margin-top: 12px;
  }
  .kpi-sub {
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
    margin-top: 2px;
  }
  .kpi-breakdown {
    display: flex;
    gap: 10px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(23,24,26,.09);
  }
  .bd {
    flex: 1 1 0;
    background: rgba(255,255,255,.72);
    border-radius: 12px;
    padding: 8px 10px;
  }
  .bd-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .bd-value {
    font-family: 'Oswald', 'Arial Narrow', sans-serif;
    font-size: 22px;
    font-weight: 600;
    line-height: 1.15;
    margin-top: 1px;
  }

  .pct-sign { margin-left: 0.04em; }

  /* ── Footer quote ───────────────────────────────────────────────────── */
  .footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    margin: 0 40px;
    padding: 22px 0 30px;
    border-top: 1px solid var(--hairline);
  }
  .footer-icon {
    flex: 0 0 auto;
    width: 44px; height: 44px;
    border-radius: 50%;
    background: var(--orange-tint);
    display: flex; align-items: center; justify-content: center;
  }
  .footer-icon svg { display: block; }
  .footer-quote {
    max-width: 780px;
    font-size: 19px;
    font-weight: 500;
    font-style: italic;
    line-height: 1.45;
    color: var(--ink);
  }

  .nodata { color: var(--muted); font-size: 17px; font-weight: 400; font-style: normal; }
</style>
</head>
<body>
<div class="dashboard">

  <div class="top-bar">
    <div class="brand">
      <div class="logo-badge"><img src="/report-logo.png" alt="Little Caesars" /></div>
      <div>
        <div class="title">DSPR Report</div>
        <div class="subtitle">Daily Store Performance Recap</div>
      </div>
    </div>
    <div class="head-meta">
      <div class="chip"><span class="chip-key">Store</span>${esc(storeId)}</div>
      <div class="chip"><span class="chip-key">Date</span>${esc(format(selectedDate, "EEEE, MMMM d, yyyy"))}</div>
    </div>
  </div>

  ${heroHtml}

  <div class="kpis${trimmedName ? "" : " kpis--no-hero"}">
    <div class="kpi-card sky">
      <div class="kpi-head">
        <div class="kpi-chip">${icon("flame", "#0284C7", 22)}</div>
        <div class="kpi-label">HNR Special</div>
      </div>
      <div class="kpi-value">${hnrSpecial != null ? fmtPct1(hnrSpecial.hnr_promise_met_percent) : NO_DATA}</div>
      <div class="kpi-sub">Promise met</div>
      ${
        hnrSpecial != null
          ? `<div class="kpi-breakdown">
               <div class="bd"><div class="bd-label">Kept</div><div class="bd-value">${hnrSpecial.hnr_promise_met}</div></div>
               <div class="bd"><div class="bd-label">Broken</div><div class="bd-value">${hnrSpecial.hnr_broken_promises}</div></div>
               <div class="bd"><div class="bd-label">Trans.</div><div class="bd-value">${hnrSpecial.hnr_transactions}</div></div>
             </div>`
          : ""
      }
    </div>

    <div class="kpi-card violet">
      <div class="kpi-head">
        <div class="kpi-chip">${icon("smile", "#7C3AED", 22)}</div>
        <div class="kpi-label">Customer Service</div>
      </div>
      <div class="kpi-value">${customerServicePct != null ? fmtPct1(customerServicePct) : NO_DATA}</div>
      <div class="kpi-sub">Average of Into Portal &amp; On Time</div>
      ${
        portal != null
          ? `<div class="kpi-breakdown">
               <div class="bd"><div class="bd-label">Into Portal</div><div class="bd-value">${fmtPct1(portal.put_into_portal_percent)}</div></div>
               <div class="bd"><div class="bd-label">On Time</div><div class="bd-value">${fmtPct1(portal.in_portal_on_time_percent)}</div></div>
             </div>`
          : ""
      }
    </div>

    <div class="kpi-card rose">
      <div class="kpi-head">
        <div class="kpi-chip">${icon("coins", "#E11D48", 22)}</div>
        <div class="kpi-label">Total Tips</div>
      </div>
      <div class="kpi-value">${tips != null ? fmtMoney0(tips) : NO_DATA}</div>
      <div class="kpi-sub">Collected today</div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-icon">${icon("quote", "#ED680F", 20)}</div>
    <div class="footer-quote">${esc(safeFooterMessage)}</div>
  </div>

</div>
</body>
</html>`;

  return html;
}
