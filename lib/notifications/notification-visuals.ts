import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CalendarClock,
  CalendarPlus,
  CheckCircle,
  Coffee,
  FileBarChart,
  Info,
  KeyRound,
  Megaphone,
  MessageSquareWarning,
  Shirt,
  SprayCan,
  TrendingUp,
  UserMinus,
  Wrench,
} from "lucide-react";
import { accentOf, type Accent } from "@/lib/announcements/colors";

/**
 * How a notification looks, by its `type`: one icon and one colour, shared by
 * the list rows (bell drawer) and the toast stack so the two never drift apart.
 *
 * `chip` is the tinted icon circle (soft fill + text colour, light and dark).
 * `accent` feeds the announcement ring (`AccentFrame` / `.ann-ring`): two
 * shades of the same hue (500 → 400) so the glowing toast border reads as the
 * notification's own colour. The class strings stay literal so Tailwind sees
 * them.
 */

interface Tone {
  chip: string;
  accent: Accent;
}

function tone(chip: string, start: string, end: string): Tone {
  return { chip, accent: accentOf({ color_start: start, color_end: end }) };
}

const TONES = {
  destructive: tone("bg-destructive/10 text-destructive", "#ef4444", "#f87171"),
  emerald: tone(
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    "#10b981",
    "#34d399",
  ),
  sky: tone("bg-sky-500/10 text-sky-600 dark:text-sky-400", "#0ea5e9", "#38bdf8"),
  amber: tone("bg-amber-500/10 text-amber-600 dark:text-amber-400", "#f59e0b", "#fbbf24"),
  rose: tone("bg-rose-500/10 text-rose-600 dark:text-rose-400", "#f43f5e", "#fb7185"),
  orange: tone("bg-orange-500/10 text-orange-600 dark:text-orange-400", "#f97316", "#fb923c"),
  purple: tone("bg-purple-500/10 text-purple-600 dark:text-purple-400", "#a855f7", "#c084fc"),
  violet: tone("bg-violet-500/10 text-violet-600 dark:text-violet-400", "#8b5cf6", "#a78bfa"),
  blue: tone("bg-blue-500/10 text-blue-600 dark:text-blue-400", "#3b82f6", "#60a5fa"),
  pink: tone("bg-pink-500/10 text-pink-600 dark:text-pink-400", "#ec4899", "#f472b6"),
  green: tone("bg-green-500/10 text-green-600 dark:text-green-400", "#22c55e", "#4ade80"),
  yellow: tone("bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", "#eab308", "#facc15"),
  cyan: tone("bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", "#06b6d4", "#22d3ee"),
} satisfies Record<string, Tone>;

type ToneKey = keyof typeof TONES;

export interface NotificationVisuals {
  Icon: LucideIcon;
  /** Tinted icon circle classes. */
  chip: string;
  /** Ring colours for `AccentFrame`. */
  accent: Accent;
}

function visuals(Icon: LucideIcon, key: ToneKey): NotificationVisuals {
  return { Icon, chip: TONES[key].chip, accent: TONES[key].accent };
}

/**
 * Icon and colour for a notification type. First match wins; the order is the
 * one the list has always used (e.g. a failed report is red before any other
 * `report_` rule, `cleaning_` comes after the substring rules).
 */
export function getNotificationVisuals(type: string): NotificationVisuals {
  if (type === "report_failed" || type === "report_delivery_failed") {
    return visuals(FileBarChart, "destructive");
  }
  if (type.startsWith("report_")) return visuals(FileBarChart, "emerald");
  if (type.startsWith("maintenance_")) return visuals(Wrench, "sky");
  if (type.startsWith("break_")) return visuals(Coffee, "amber");
  if (type.startsWith("ticket_")) return visuals(MessageSquareWarning, "rose");
  if (type.startsWith("data_entry_key")) return visuals(KeyRound, "orange");
  if (type.startsWith("announcement")) return visuals(Megaphone, "purple");
  // Something given to you in the Calendar ("Chosen people": a task or an event).
  if (type === "calendar_assigned") return visuals(CalendarPlus, "violet");
  if (type.startsWith("calendar_")) return visuals(CalendarClock, "violet");
  if (type.startsWith("hiring_request")) return visuals(Briefcase, "blue");
  if (type.startsWith("shirt_milestone")) return visuals(Shirt, "pink");
  if (type.startsWith("employee_promoted")) return visuals(TrendingUp, "green");
  if (type.startsWith("separation_request")) return visuals(UserMinus, "amber");
  if (type.includes("warning") || type.includes("alert")) return visuals(AlertTriangle, "yellow");
  if (type.includes("success") || type.includes("completed")) return visuals(CheckCircle, "green");
  if (type.includes("error") || type.includes("fail")) return visuals(AlertTriangle, "destructive");
  if (type.includes("info")) return visuals(Info, "blue");
  if (type.startsWith("cleaning_")) return visuals(SprayCan, "cyan");
  return visuals(Bell, "blue");
}
