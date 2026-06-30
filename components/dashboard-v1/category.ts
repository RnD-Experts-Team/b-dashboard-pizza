import {
  TrendingUp,
  Activity,
  Pizza,
  Users,
  Banknote,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
 *  Dashboard V1 — category taxonomy & color tokens.
 *
 *  Every card on the V1 dashboard belongs to exactly ONE category, and the
 *  category owns the color. Recoloring a whole group = editing one object here.
 *  All tokens are plain Tailwind class strings so they tree-shake normally.
 * ────────────────────────────────────────────────────────────────────────── */

export type CategoryKey =
  | "sales"
  | "operations"
  | "menu"
  | "people"
  | "finance"
  | "quality";

export interface CategoryToken {
  key: CategoryKey;
  label: string;
  icon: LucideIcon;
  /** Foreground accent (text + icon glyph). */
  text: string;
  /** Tinted icon-box background. */
  iconBg: string;
  /** Left accent border for the card. */
  border: string;
  /** Soft gradient wash for the card surface. */
  gradient: string;
  /** Header label color + section divider. */
  headerText: string;
  /** Chart palette ramp [primary, secondary, tertiary]. */
  chartColors: [string, string, string];
  /** Optional full border applied to each card in the section. */
  cardBorder?: string;
}

export const CATEGORIES: Record<CategoryKey, CategoryToken> = {
  sales: {
    key: "sales",
    label: "Sales & Trends",
    icon: TrendingUp,
    text: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-500/15 dark:bg-emerald-500/20",
    border: "border-l-emerald-500",
    gradient:
      "bg-linear-to-br from-emerald-50/80 via-emerald-50/30 to-transparent dark:from-emerald-950/30 dark:via-emerald-950/10 dark:to-transparent",
    headerText: "text-emerald-700 dark:text-emerald-300",
    chartColors: ["#10b981", "#34d399", "#a7f3d0"],
    cardBorder: "border border-emerald-500/25 dark:border-emerald-400/15",
  },
  operations: {
    key: "operations",
    label: "Operations & Speed",
    icon: Activity,
    text: "text-sky-600 dark:text-sky-400",
    iconBg: "bg-sky-500/15 dark:bg-sky-500/20",
    border: "border-l-sky-500",
    gradient:
      "bg-linear-to-br from-sky-50/80 via-sky-50/30 to-transparent dark:from-sky-950/30 dark:via-sky-950/10 dark:to-transparent",
    headerText: "text-sky-700 dark:text-sky-300",
    chartColors: ["#0ea5e9", "#38bdf8", "#bae6fd"],
  },
  menu: {
    key: "menu",
    label: "Menu & Product",
    icon: Pizza,
    text: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/15 dark:bg-amber-500/20",
    border: "border-l-amber-500",
    gradient:
      "bg-linear-to-br from-amber-50/80 via-amber-50/30 to-transparent dark:from-amber-950/30 dark:via-amber-950/10 dark:to-transparent",
    headerText: "text-amber-700 dark:text-amber-300",
    chartColors: ["#f59e0b", "#fbbf24", "#fde68a"],
  },
  people: {
    key: "people",
    label: "People & Labor",
    icon: Users,
    text: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-500/15 dark:bg-violet-500/20",
    border: "border-l-violet-500",
    gradient:
      "bg-linear-to-br from-violet-50/80 via-violet-50/30 to-transparent dark:from-violet-950/30 dark:via-violet-950/10 dark:to-transparent",
    headerText: "text-violet-700 dark:text-violet-300",
    chartColors: ["#8b5cf6", "#a78bfa", "#ddd6fe"],
  },
  finance: {
    key: "finance",
    label: "Finance & Cash",
    icon: Banknote,
    text: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-500/15 dark:bg-rose-500/20",
    border: "border-l-rose-500",
    gradient:
      "bg-linear-to-br from-rose-50/80 via-rose-50/30 to-transparent dark:from-rose-950/30 dark:via-rose-950/10 dark:to-transparent",
    headerText: "text-rose-700 dark:text-rose-300",
    chartColors: ["#f43f5e", "#fb7185", "#fecdd3"],
  },
  quality: {
    key: "quality",
    label: "Quality & Voice of Customer",
    icon: ShieldCheck,
    text: "text-cyan-600 dark:text-cyan-400",
    iconBg: "bg-cyan-500/15 dark:bg-cyan-500/20",
    border: "border-l-cyan-500",
    gradient:
      "bg-linear-to-br from-cyan-50/80 via-cyan-50/30 to-transparent dark:from-cyan-950/30 dark:via-cyan-950/10 dark:to-transparent",
    headerText: "text-cyan-700 dark:text-cyan-300",
    chartColors: ["#06b6d4", "#22d3ee", "#a5f3fc"],
  },
};

/** Period a card's data represents — drives the small badge on each card. */
export type Period = "D" | "W" | "D·WTD";

export const PERIOD_LABEL: Record<Period, string> = {
  D: "Daily",
  W: "Weekly",
  "D·WTD": "Day · WTD",
};
