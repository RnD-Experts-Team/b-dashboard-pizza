/* ────────────────────────────────────────────────────────────────────────── */
/*  Pairing a mistaken movement with the reversal that cancels it            */
/*                                                                            */
/*  Pure, non-React.                                                         */
/*                                                                            */
/*  THE RULE THIS MODULE SERVES:                                             */
/*                                                                            */
/*    A movement flagged `mistaken` STILL COUNTS. It stays in                 */
/*    SUM(quantity × direction) exactly as before it was flagged — the flag   */
/*    is a display marker with no arithmetic effect. The correction IS the    */
/*    separate reversal movement.                                            */
/*                                                                            */
/*    So the UI must show the PAIR. Rendering the original as "excluded" AND  */
/*    also rendering its reversal would make one correction look like it      */
/*    happened twice.                                                        */
/*                                                                            */
/*  ⚠ NEVER sum the visible page to get on hand. The ledger is unfiltered and */
/*  paginated, so a page sum is meaningless. Always read GET /stock-balances. */
/* ────────────────────────────────────────────────────────────────────────── */

import type { StockMovement, StockMovementLine } from "@/types/storage.types";

/** A line reduced to the bits that must mirror for a pair to be confident. */
interface LineKey {
  partId: number;
  storageLocationId: number;
  quantity: number;
  direction: number;
}

function lineKeys(lines: StockMovementLine[]): string[] {
  return lines
    .map((l) => `${l.partId}:${l.storageLocationId}:${l.quantity}:${l.direction}`)
    .sort();
}

/** The same lines with every direction flipped — what a reversal should be. */
function flippedLineKeys(lines: StockMovementLine[]): string[] {
  return lines
    .map((l) => `${l.partId}:${l.storageLocationId}:${l.quantity}:${-l.direction}`)
    .sort();
}

function sameKeys(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Finds the reversal that cancels `movement`, from the movements currently
 * loaded.
 *
 * PREFERS EXPLICIT IDS. Only falls back to shape-matching when the API did not
 * link the pair, and returns `null` rather than guessing when the shape match
 * is ambiguous — a wrongly-paired reversal would tell the reader a correction
 * landed somewhere it did not.
 */
export function findReversalFor(
  movement: StockMovement,
  page: StockMovement[]
): StockMovement | null {
  if (!movement.mistaken) return null;

  // 1. Explicit link from the API, in either direction.
  if (movement.reversedByIds.length > 0) {
    const byId = page.find((m) => movement.reversedByIds.includes(m.id));
    if (byId) return byId;
    // The API named one but it is not on this page — do not fall through to
    // shape matching, or we could surface a DIFFERENT reversal as if it were
    // the named one.
    return null;
  }
  const byBackLink = page.find((m) => m.reversalOfId === movement.id);
  if (byBackLink) return byBackLink;

  // 2. Shape match, only when both sides have their lines loaded.
  if (movement.lines == null) return null;
  const wanted = flippedLineKeys(movement.lines);

  const candidates = page.filter((m) => {
    if (m.id === movement.id) return false;
    if (m.type.value !== "reversal") return false;
    if (m.lines == null) return false;
    // A reversal is written after the thing it reverses.
    if (new Date(m.createdAt).getTime() < new Date(movement.createdAt).getTime()) {
      return false;
    }
    return sameKeys(lineKeys(m.lines), wanted);
  });

  // Ambiguous — two identical movements could each own either reversal, and
  // picking one would be a coin flip presented as a fact.
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Finds what a reversal reverses, for the back-link on the reversal's own row.
 */
export function findOriginalFor(
  reversal: StockMovement,
  page: StockMovement[]
): StockMovement | null {
  if (reversal.type.value !== "reversal") return null;

  if (reversal.reversalOfId != null) {
    return page.find((m) => m.id === reversal.reversalOfId) ?? null;
  }

  if (reversal.lines == null) return null;
  const wanted = flippedLineKeys(reversal.lines);

  const candidates = page.filter((m) => {
    if (m.id === reversal.id) return false;
    if (!m.mistaken) return false;
    if (m.lines == null) return false;
    if (new Date(m.createdAt).getTime() > new Date(reversal.createdAt).getTime()) {
      return false;
    }
    return sameKeys(lineKeys(m.lines), wanted);
  });

  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * The signed contribution of one movement, for a per-movement display figure.
 *
 * This is NOT on-hand and must never be presented as one — it is only what
 * this single movement did. Include it for a mistaken movement exactly as for
 * any other: the flag changes nothing about the arithmetic.
 */
export function movementNetByLocation(
  movement: StockMovement
): Map<number, number> {
  const out = new Map<number, number>();
  for (const line of movement.lines ?? []) {
    out.set(
      line.storageLocationId,
      (out.get(line.storageLocationId) ?? 0) + line.signedQuantity
    );
  }
  return out;
}

export type { LineKey };
