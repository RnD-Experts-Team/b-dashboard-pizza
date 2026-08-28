import {
  BarChart3,
  Bell,
  Calendar,
  Car,
  Coffee,
  DollarSign,
  Gauge,
  LayoutDashboard,
  Pizza,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import type { GuideStep } from "@/components/shared/page-guide";

/**
 * Guide steps for Dashboard V1.
 *
 * Two kinds of step live in here:
 *  - topbar steps (`topbar-notifications`, `topbar-drive-thru`,
 *    `topbar-break-timer`), targeting the global Topbar widgets. The tour opens
 *    on these: they're the tools that follow you onto every other page, and
 *    they're always on screen — the Topbar sits outside AppShell's scroll
 *    container — so spotlighting them never scrolls the page.
 *  - page steps, targeting `data-guide-id` attributes on this dashboard's own
 *    header and category sections.
 *
 * The topbar widgets hide themselves when they don't apply (DriveThruButton
 * needs a drive-thru station plus Screens access), so `DashboardV1` filters
 * steps whose target isn't in the DOM at the moment the guide opens.
 */
export const DASHBOARD_V1_GUIDE_STEPS: GuideStep[] = [
  // ── Step 0: Intro (no spotlight, centered card) ───────────────────────────
  {
    id: "v1-intro",
    title: "Dashboard V1 — your store's day at a glance",
    icon: LayoutDashboard,
    description:
      "Same numbers as the main report, reorganized into six color-coded sections so you can find what you need fast. A few things worth knowing first:",
    bullets: [
      "Each section has its own color — green for sales, blue for operations, amber for menu, violet for people, rose for finance, cyan for quality",
      "Most cards show today's number next to the week-to-date average, so you can compare at a glance",
      "Cards with tabs or an expand button hold more detail — tap them to drill in",
      "The date picker at the top opens any past day; refresh pulls the latest data",
      "We'll start with the three topbar tools that follow you across every page — notifications, drive thru and break timer — then walk down this page",
    ],
    placement: "bottom",
    noHighlight: true,
  },

  // ── Topbar tools — the tour starts here ──────────────────────────────────
  {
    id: "topbar-notifications",
    title: "Notifications",
    icon: Bell,
    description:
      "Everything the system needs you to know, in one bell. The red badge counts unread items and updates in real time — no refresh needed.",
    bullets: [
      "Two tabs: All, and Unread with its own count",
      "Notifications are color-coded by kind — debrief keys, announcements, hiring, separations, milestone gifts, promotions, cleaning",
      "Clicking one takes you straight to where it happened: the debrief key opens in place, hiring goes to the right request tab, cleaning opens that period's evaluation",
      "Hover an unread item for the ✓ to mark just that one read, or “Mark all as read” in the header",
      "The sidebar shows a matching unread dot on whichever page the notification points to",
    ],
    placement: "bottom",
  },
  {
    id: "topbar-drive-thru",
    title: "Drive Thru",
    icon: Car,
    description:
      "Live audio to your store's drive-thru station, available from any page.",
    bullets: [
      "The dot on the car icon is the connection status — red means disconnected, green means live",
      "Click while disconnected to confirm, then you can hear and talk to the drive-thru",
      "Once connected, clicking toggles the drive-thru panel open and closed",
      "The connection stays active in the background as you move between pages, until you disconnect",
      "The button only appears when your store has a drive-thru station and you have Screen Project access",
    ],
    placement: "bottom",
  },
  {
    id: "topbar-break-timer",
    title: "Break Timer",
    icon: Coffee,
    description:
      "Tracks your breaks for the day, right from the topbar. The counter is cumulative — it measures your break budget, not one break at a time.",
    bullets: [
      "One click starts a break; click again to end it. A live m:ss clock appears next to the coffee cup while it runs",
      "Double-click opens the panel — start/end, the day's history, and settings",
      "A new break resumes from the total of earlier breaks in the same cycle instead of restarting at 0:00",
      "“Fresh counter” in the panel zeroes the clock and starts a new cycle; the day's overall total keeps counting beside it",
      "Set an overtime limit in minutes in the panel. Cross it and the button turns red, pulses, and repeats an alert sound until you end the break",
      "Every finished break is listed with its start and end time; the whole thing resets on its own each day",
    ],
    placement: "bottom",
  },

  // ── This page ────────────────────────────────────────────────────────────
  {
    id: "v1-header",
    title: "Dashboard Controls",
    icon: Calendar,
    description:
      "Everything that changes what you're looking at, plus the export menu.",
    bullets: [
      "Store badge shows which store the report belongs to — switch stores from the sidebar",
      "Date picker opens any day up to yesterday; the week badge shows the ISO week that day falls in",
      "A “Stale” badge or the last-updated time tells you how fresh the data is — click either to refresh",
      "The ⋮ menu exports three ways: Ultra HD screenshot of this page, Report screenshot (PNG), and DSPR Report (PNG)",
      "The ? button reopens this guide anytime",
    ],
    placement: "bottom",
  },
  {
    id: "v1-summary",
    title: "Day Summary",
    icon: Gauge,
    description:
      "The KPI strip for the selected day — total sales, order count, ticket average, cash, deposits and the rest of the headline numbers.",
    placement: "bottom",
  },
  {
    id: "v1-sales",
    title: "Sales & Trends",
    icon: TrendingUp,
    description:
      "How the store sold, from the week's shape down to the hour.",
    bullets: [
      "Sales Trend charts the week with labor overlaid day by day",
      "Store Score covers the scorecard ranking, goal metrics and upselling score",
      "Manager Tasks, Customer Count & Sales, and Phone & Adjusted Sales sit alongside it",
      "Hourly Sales has a “By Channel” tab for the daily channel mix",
      "Orders vs Sales, weekly Channel Sales and Sales History fill out the section",
    ],
    placement: "bottom",
  },
  {
    id: "v1-operations",
    title: "Operations & Speed",
    icon: BarChart3,
    description:
      "Service speed and cost control for the day.",
    bullets: [
      "Portal gauge — on-time delivery percentage",
      "HNR (Handoff Not Received), including the important-items breakdown",
      "Labor % against target, with the weekly labor entries behind it",
      "Go-To, Portal Weekly and Non-Negotiable reports",
    ],
    placement: "bottom",
  },
  {
    id: "v1-menu",
    title: "Menu & Product",
    icon: Pizza,
    description:
      "What sold and what it consumed.",
    bullets: [
      "Top Items by sales and by count, plus upselling",
      "Top Ingredients — main, paper, most used, and the highest/lowest variance",
      "Promo and LTO performance",
    ],
    placement: "bottom",
  },
  {
    id: "v1-people",
    title: "People & Labor",
    icon: Users,
    description:
      "Who's working and what the team costs.",
    bullets: [
      "Employees currently on shift",
      "High hours worked this period",
      "Upcoming birthdays",
      "Average hourly pay against the week's labor entries",
    ],
    placement: "bottom",
  },
  {
    id: "v1-finance",
    title: "Finance & Cash",
    icon: DollarSign,
    description:
      "Cash control for the day, transfers in and out between stores, and money owed for the week.",
    placement: "bottom",
  },
  {
    id: "v1-quality",
    title: "Quality & Voice of Customer",
    icon: ShieldCheck,
    description:
      "How the store is judged — from the inside and the outside.",
    bullets: [
      "QA ratings overview and open maintenance tickets",
      "Customer complaints and feedbacks for the week",
      "Cleaning review and customer service scores",
      "Portioning accuracy across the full width of the section",
    ],
    placement: "bottom",
  },
];
