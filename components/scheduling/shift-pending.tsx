"use client";

import { Loader2 } from "lucide-react";

/**
 * "This card is working on it."
 *
 * Every action on a shift goes to the API and then waits for the week to
 * refetch. Until that lands nothing on the card changed, so a manager who
 * clicked Agree or Delete had no way to tell whether the click registered —
 * and the natural response to silence is to click again.
 *
 * The card is dimmed rather than replaced with a skeleton: these actions mostly
 * CHANGE a card rather than remove it, and swapping in a grey block hides the
 * very shift you were looking at. Fading it keeps the context and still reads
 * as busy.
 *
 * Ids are namespaced because a planned shift and an actual shift can carry the
 * same numeric id from different tables — without the prefix, a pending actual
 * would dim an unrelated planned card.
 */

export const pendingShiftKey = (shiftId: string) => `shift:${shiftId}`;
export const pendingActualKey = (actualId: string) => `actual:${actualId}`;

/** Applied to the card itself. `pointer-events-none` also stops double-firing. */
export const PENDING_CARD_CLASS = "opacity-50 pointer-events-none";

export function ShiftPendingOverlay() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
    >
      <Loader2 className="h-4 w-4 animate-spin text-foreground/80" />
    </span>
  );
}
