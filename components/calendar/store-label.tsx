"use client";

import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/calendar/types";

/**
 * Whether the calendar is showing more than one store. With one store every
 * chip belongs to it and a badge would only be noise; with several, two
 * "Cleaning 0/19" chips are indistinguishable without it. Provided once by the
 * page, read by the chips and cards (React context crosses the peek's portal).
 */
const ShowStoreContext = createContext(false);

export const ShowStoreProvider = ShowStoreContext.Provider;

export function useShowStore(): boolean {
  return useContext(ShowStoreContext);
}

/** "Chatterton" → "CH", "Columbus Square" → "CS". Safe for any script (counts code points). */
export function storeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const first = Array.from(words[0]);
  const letters = words.length > 1 ? first[0] + (Array.from(words[1])[0] ?? "") : first.slice(0, 2).join("");
  return letters.toUpperCase();
}

/**
 * A small initials badge for the front of a chip. A store NAME there would
 * squeeze out the title and its status ("19 overdue"), which matters more, so
 * the badge is fixed-width and the full name rides along as a tooltip, for
 * screen readers, and in the peek cards. Renders nothing for one-store views
 * and for company-wide events (no store).
 */
export function StoreLabel({ ev, className }: { ev: CalendarEvent; className?: string }) {
  const show = useShowStore();
  if (!show || ev.companyWide || !ev.store.name) return null;
  return (
    <span
      data-slot="calendar-store-label"
      title={ev.store.name}
      className={cn(
        "inline-grid h-4 min-w-5 shrink-0 place-items-center rounded-sm bg-muted px-1 text-[9px] font-semibold leading-none tracking-wide text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden>{storeInitials(ev.store.name)}</span>
      <span className="sr-only">{ev.store.name}</span>
    </span>
  );
}
