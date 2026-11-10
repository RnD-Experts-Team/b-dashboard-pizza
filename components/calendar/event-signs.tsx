"use client";

import { createContext, useContext } from "react";
import { useTranslations } from "next-intl";
import { BellRing, Check, Play, Send, Undo2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { taskSign, type TaskSign } from "@/lib/calendar/toolbox-write";
import type { CalendarEvent } from "@/lib/calendar/types";

/**
 * Small signs on an event that say where it stands without opening it: a bell
 * when I set a reminder for it, and for a store task ▶ started, ✈ submitted
 * (waiting for review), ↩ returned, ✓ approved — the same icons as the buttons
 * on its card, so the sign and the action read as one vocabulary. Neutral on
 * purpose: the calendar keeps red for overdue/missed.
 */
export type Sign = "reminder" | TaskSign;

const ICON: Record<Sign, LucideIcon> = {
  reminder: BellRing,
  started: Play,
  submitted: Send,
  returned: Undo2,
  approved: Check,
};

/**
 * Optical centring, in px at the 12px icon size. These icons are drawn in a
 * centred 24-unit box but their ink is lopsided: measured on the rendered strokes,
 * the paper plane's weight sits ~1.8 units right and ~1.9 up, the ▶ ~1 left and the
 * bell ~1.4 up. Each is moved by ~80% of that (half a unit-to-px at this size), so
 * it reads as centred in its circle. ✓ and ↩ are already even.
 */
const NUDGE: Partial<Record<Sign, readonly [x: number, y: number]>> = {
  submitted: [-0.7, 0.7],
  started: [0.4, 0],
  reminder: [0, 0.55],
};

const NONE: ReadonlyMap<string, readonly CalendarEvent[]> = new Map();

/** My reminders by the event they were made from. Provided by the Calendar page; the topbar panel passes its own. */
const ReminderTargetsContext = createContext<ReadonlyMap<string, readonly CalendarEvent[]>>(NONE);
export const ReminderTargetsProvider = ReminderTargetsContext.Provider;

/** The signs of an event, the task's state first. A roll-up (several stores) has none of its own. */
export function signsOf(ev: CalendarEvent, reminders: ReadonlyMap<string, readonly CalendarEvent[]>): Sign[] {
  if (ev.members) return [];
  const out: Sign[] = [];
  const state = taskSign(ev);
  if (state) out.push(state);
  if (reminders.get(ev.id)?.length) out.push("reminder");
  return out;
}

export function EventSigns({
  ev,
  words = false,
  className,
}: {
  ev: CalendarEvent;
  /** Spell each sign out ("Started", "Reminder set") — on the event's card. Otherwise icons with a tooltip. */
  words?: boolean;
  className?: string;
}) {
  const t = useTranslations("calendar.signs");
  const reminders = useContext(ReminderTargetsContext);
  const signs = signsOf(ev, reminders);
  if (!signs.length) return null;

  if (words) {
    return (
      <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
        {signs.map((s) => {
          const Icon = ICON[s];
          return (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
              <Icon className="size-3" aria-hidden />
              {t(s)}
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5 align-middle", className)}>
      {signs.map((s) => {
        const Icon = ICON[s];
        const nudge = NUDGE[s];
        return (
          <span key={s} title={t(s)} className="grid size-[18px] shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground/80">
            <Icon className="size-3" style={nudge ? { transform: `translate(${nudge[0]}px, ${nudge[1]}px)` } : undefined} aria-hidden />
            <span className="sr-only">{t(s)}</span>
          </span>
        );
      })}
    </span>
  );
}
