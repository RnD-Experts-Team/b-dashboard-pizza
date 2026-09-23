/* ────────────────────────────────────────────────────────────────────────── */
/*  Reading structure out of maintenance-ticket errors                       */
/*                                                                            */
/*  The service has always attached Laravel's 422 `errors` bag to its error   */
/*  object, but nothing in the UI ever read it — every panel surfaced only    */
/*  `err.message`. These helpers are what make per-field errors and the       */
/*  inline stock-shortfall callout possible.                                  */
/*                                                                            */
/*  Mirrors the sibling-module pattern of lib/api/inventory-errors.ts.        */
/* ────────────────────────────────────────────────────────────────────────── */

import { MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";

/** The shortfall the API reports when a storage draw exceeds what is on hand. */
export interface StockShortfallContext {
  partId: number;
  storageLocationId: number;
  requested: number;
  available: number;
  /** requested − available, for "short by N". */
  shortBy: number;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Reads the 422 `context` block the API sends on a stock shortfall:
 *
 *   { part_id: 7, storage_location_id: 2, requested: "20.00", available: "10.00" }
 *
 * Returns null unless this is a VALIDATION_ERROR carrying all four keys — it
 * never guesses, so an unrelated 422 falls through to generic handling rather
 * than rendering a half-populated shortfall callout.
 */
export function readStockShortfall(err: unknown): StockShortfallContext | null {
  if (!(err instanceof MaintenanceTicketsError)) return null;
  if (err.code !== "VALIDATION_ERROR") return null;
  const ctx = err.context;
  if (!ctx) return null;

  const partId = readNumber(ctx.part_id);
  const storageLocationId = readNumber(ctx.storage_location_id);
  const requested = readNumber(ctx.requested);
  const available = readNumber(ctx.available);

  if (
    partId == null ||
    storageLocationId == null ||
    requested == null ||
    available == null
  ) {
    return null;
  }

  return {
    partId,
    storageLocationId,
    requested,
    available,
    shortBy: requested - available,
  };
}

/**
 * Flattens Laravel's 422 `errors` bag into a field → first-message map.
 *
 * Keys are DOTTED and match the payload path exactly, e.g. "quantity",
 * "lines.0.quantity", or a bare "lines" for a whole-array complaint — so a
 * caller can look up a field directly, and should render anything it does not
 * recognise at form level rather than dropping it.
 */
export function getTicketsFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof MaintenanceTicketsError)) return {};
  if (!err.validationErrors) return {};
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(err.validationErrors)) {
    if (messages?.[0]) out[field] = messages[0];
  }
  return out;
}

/** True when the error is a cancelled/aborted request, which is not user-visible. */
export function isCancelled(err: unknown): boolean {
  return err instanceof MaintenanceTicketsError && err.code === "CANCELLED";
}
