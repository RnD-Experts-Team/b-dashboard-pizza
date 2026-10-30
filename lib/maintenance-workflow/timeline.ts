/**
 * The ticket page's Activity tab: the server's merged, newest-first
 * `timeline` ({at, kind, text, actor}) plus — for whoever may read them —
 * the MOS-only notes, which the server never puts on the timeline. Each kind
 * gets an icon (lucide name, resolved by the component) and a dot tone.
 */

import type { TicketNote } from "@/types/maintenance-tickets.types";
import type { IdName, TimelineEntry } from "@/types/maintenance-v2";

export type TimelineTone = "neutral" | "store" | "technician" | "money" | "done" | "warning";

export interface TimelineKindMeta {
  icon: string;
  tone: TimelineTone;
}

/** The kinds TicketIssuePresenter::timeline writes. Unknown kinds read as neutral. */
const KIND_META: Record<string, TimelineKindMeta> = {
  status_changed: { icon: "ArrowRightLeft", tone: "neutral" },
  info_requested: { icon: "MessageCircleQuestion", tone: "store" },
  info_answered: { icon: "MessageCircleReply", tone: "store" },
  inspection_booked: { icon: "ScanSearch", tone: "technician" },
  inspection_done: { icon: "ClipboardCheck", tone: "technician" },
  approval: { icon: "Stamp", tone: "money" },
  scheduled: { icon: "CalendarPlus", tone: "technician" },
  schedule_moved: { icon: "CalendarClock", tone: "warning" },
  visit_arrived: { icon: "MapPin", tone: "technician" },
  visit_left: { icon: "LogOut", tone: "technician" },
  visit_done: { icon: "CircleCheck", tone: "done" },
  visit_not_done: { icon: "CircleX", tone: "warning" },
  payment: { icon: "Wallet", tone: "money" },
  purchase: { icon: "ShoppingBag", tone: "money" },
  stock_used: { icon: "Package", tone: "neutral" },
  note: { icon: "StickyNote", tone: "neutral" },
  store_confirmed: { icon: "Store", tone: "done" },
};

const FALLBACK: TimelineKindMeta = { icon: "Circle", tone: "neutral" };

export function timelineKindMeta(kind: string): TimelineKindMeta {
  return KIND_META[kind] ?? FALLBACK;
}

/** Paired light/dark classes for a dot (the card beside it always carries text). */
export const TIMELINE_TONE_CLASS: Record<TimelineTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  store: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  technician: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  money: "bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  warning: "bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
};

export function actorName(actor: TimelineEntry["actor"]): string | null {
  if (!actor) return null;
  return typeof actor === "string" ? actor : (actor as IdName).name ?? null;
}

const NOTE_PREVIEW = 200;

/**
 * The server's timeline with the private notes woven in by time (newest
 * first). Notes already public are on the server's timeline as "Note: …",
 * so only the private ones are added here.
 */
export function withPrivateNotes(timeline: readonly TimelineEntry[], notes: readonly TicketNote[]): TimelineEntry[] {
  const extra: TimelineEntry[] = notes
    .filter((n) => n.isPrivate)
    .map((n) => ({
      at: n.createdAt,
      kind: "note",
      text: n.body.length > NOTE_PREVIEW ? `${n.body.slice(0, NOTE_PREVIEW)}…` : n.body,
      actor: n.creator?.name ?? null,
      isPrivate: true,
    }));
  if (!extra.length) return [...timeline];
  const time = (e: TimelineEntry) => {
    const ms = new Date(e.at).getTime();
    return Number.isFinite(ms) ? ms : 0;
  };
  return [...timeline, ...extra].sort((a, b) => time(b) - time(a));
}
