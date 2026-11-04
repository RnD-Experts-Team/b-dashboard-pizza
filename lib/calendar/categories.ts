import {
  Award,
  BellRing,
  Cake,
  ClipboardList,
  Clock,
  ListChecks,
  Megaphone,
  Package,
  Pizza,
  Shapes,
  SprayCan,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_KEYS, type CategoryKey } from "./types";

/**
 * The event-category taxonomy — same idea as `components/dashboard-v1/category.ts`:
 * each category owns its colour, so recolouring a group is editing one entry.
 *
 * The calendar is deliberately MONOCHROME. Every surface, border and text is
 * neutral (bg-muted / bg-card / text-foreground); a category's colour shows up
 * ONLY as a small dot (`dot`). Do not add tinted fills or coloured borders —
 * an earlier tinted version read as muddy, especially in dark mode. The red
 * now-line and the "Overdue" badge are the only other colour.
 */
export interface CalendarCategory {
  key: CategoryKey;
  icon: LucideIcon;
  /** The ONLY colour a category gets: a small dot. */
  dot: string;
}

const BY_KEY = new Map<CategoryKey, CalendarCategory>(
  (
    [
      { key: "maintenance", icon: Wrench, dot: "bg-orange-500" },
      { key: "shift", icon: Clock, dot: "bg-blue-500" },
      { key: "cleaning", icon: SprayCan, dot: "bg-cyan-500" },
      { key: "dough", icon: Pizza, dot: "bg-yellow-500" },
      { key: "data", icon: ClipboardList, dot: "bg-indigo-500" },
      { key: "inventory", icon: Package, dot: "bg-teal-500" },
      { key: "tasks", icon: ListChecks, dot: "bg-lime-500" },
      { key: "reminders", icon: BellRing, dot: "bg-fuchsia-500" },
      { key: "sales", icon: TrendingUp, dot: "bg-emerald-500" },
      { key: "birthday", icon: Cake, dot: "bg-pink-500" },
      { key: "milestone", icon: Award, dot: "bg-amber-500" },
      { key: "meeting", icon: Megaphone, dot: "bg-violet-500" },
      // Neutral on purpose: "other" shouldn't compete with the named types.
      { key: "other", icon: Shapes, dot: "bg-zinc-400 dark:bg-zinc-500" },
    ] satisfies CalendarCategory[]
  ).map((c) => [c.key, c]),
);

/** In `CATEGORY_KEYS` order (tabs, filter list). */
export const CALENDAR_CATEGORIES: readonly CalendarCategory[] = CATEGORY_KEYS.map((k) => BY_KEY.get(k)!);

export function categoryOf(key: CategoryKey): CalendarCategory {
  return BY_KEY.get(key) ?? BY_KEY.get("other")!;
}
