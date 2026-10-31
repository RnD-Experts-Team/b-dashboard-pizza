/**
 * The close checklist (MAINTENANCE §2 `close`): resolved · cost recorded ·
 * invoice attached · notes completed. The server sends it in
 * `workflow.checklist` with `done` per key; fixed_by_troubleshooting and
 * not_needed exempt every item. Unticked items need an override reason.
 */

import { CLOSE_CHECKLIST, type VocabEntry } from "@/lib/maintenance/vocabulary";
import type { CloseChecklistItem, CloseChecklistKey, CloseResolution } from "@/types/maintenance-system";

export const CLOSE_CHECKLIST_KEYS = [
  "resolved",
  "cost_recorded",
  "invoice_attached",
  "notes_completed",
] as const satisfies readonly CloseChecklistKey[];

/** Resolutions that exempt every checklist item. */
export const CHECKLIST_EXEMPT_RESOLUTIONS: ReadonlySet<CloseResolution> = new Set<CloseResolution>([
  "fixed_by_troubleshooting",
  "not_needed",
]);

/** The resolutions the close dialog offers, in order. */
export const CLOSE_RESOLUTIONS = [
  "repaired",
  "replaced",
  "fixed_by_troubleshooting",
  "not_needed",
] as const satisfies readonly CloseResolution[];

export function checklistLabel(key: CloseChecklistKey): VocabEntry<CloseChecklistKey> {
  return CLOSE_CHECKLIST[key];
}

/** Items still unticked for this resolution (none when it is exempt). */
export function openChecklistItems(
  checklist: readonly CloseChecklistItem[] | null | undefined,
  resolution: CloseResolution | null,
): CloseChecklistItem[] {
  if (resolution && CHECKLIST_EXEMPT_RESOLUTIONS.has(resolution)) return [];
  return (checklist ?? []).filter((item) => !item.done);
}

/** Close needs an override reason when any item is still open. */
export function closeNeedsOverride(
  checklist: readonly CloseChecklistItem[] | null | undefined,
  resolution: CloseResolution | null,
): boolean {
  return Boolean(openChecklistItems(checklist, resolution).length);
}
