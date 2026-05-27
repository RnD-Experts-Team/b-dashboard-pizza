import type { GuideStep } from "@/components/shared/page-guide";

export const DSPR_GUIDE_STEPS: GuideStep[] = [
  // ── Step 0: Intro (no spotlight, centered card) ───────────────────────────
  {
    id: "dspr-intro",
    title: "📊 Store Daily Performance Report",
    description:
      "This dashboard gives you a full picture of your store's day — from sales goals to team activity. Here's what to know before you explore:",
    bullets: [
      "Some cards show a weekly average alongside today's number so you can compare at a glance",
      "Many cards are interactive — tap them to drill into details or see trends",
      "Use the date picker at the top to explore any past day's report",
      "Hit the refresh button anytime to pull the latest data",
    ],
    placement: "bottom",
    noHighlight: true,
  },

  // ── Steps 1–7: Section spotlight tour ────────────────────────────────────
  {
    id: "dspr-header",
    title: "Dashboard Controls",
    description:
      "Select a date, switch stores, refresh data, capture a screenshot, or toggle section backgrounds.",
    placement: "bottom",
  },
  {
    id: "dspr-goals",
    title: "Store Goals",
    description:
      "Daily and weekly sales targets. Green means on track; red means the store is behind goal.",
    placement: "bottom",
  },
  {
    id: "dspr-summary",
    title: "Day Summary Stats",
    description:
      "Key KPIs at a glance — total sales, orders, ticket average, cash, deposits, and more for the selected day.",
    placement: "bottom",
  },
  {
    id: "dspr-sales",
    title: "Sales & Portal",
    description:
      "Weekly sales trend chart, store scorecard ranking, and the portal on-time delivery gauge.",
    placement: "bottom",
  },
  {
    id: "dspr-channels",
    title: "Hourly, Channels, HNR & Labor",
    description:
      "Hourly sales breakdown, daily sales by order channel, driver HNR (Handoff Not Received) metrics, and labor cost percentage vs. target.",
    placement: "bottom",
  },
  {
    id: "dspr-top-lists",
    title: "Top Items & QA",
    description:
      "Best-selling menu items, top ingredients, recent maintenance tickets, and QA rating leaders.",
    placement: "bottom",
  },
  {
    id: "dspr-employees",
    title: "Team Overview",
    description:
      "Employees currently on shift, upcoming birthdays, and top hours worked this period.",
    placement: "bottom",
  },
];
