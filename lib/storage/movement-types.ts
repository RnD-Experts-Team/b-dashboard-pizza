/* ────────────────────────────────────────────────────────────────────────── */
/*  Stock movement types and their directions — ONE source of truth     */
/*                                                                            */
/*  Pure, non-React. Labels and icons for these live in                      */
/*  lib/maintenance/vocabulary.ts (MOVEMENT_TYPES); this file says how each  */
/*  one changes stock and which ones a person may post.                      */
/*                                                                            */
/*  MAINTENANCE §5: bought +1, used −1, returned +1, moved (line says),   */
/*  opening_stock +1, stock_count (line says), damaged_lost −1,              */
/*  undone (line says).                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

import type {
  PostableStockMovementType,
  StockDirection,
  StockMovementType,
} from "@/types/storage.types";

/** null = each line states its own direction (a move has a −1 and a +1 side). */
export const FIXED_DIRECTION = {
  bought: 1,
  used: -1,
  returned: 1,
  moved: null,
  opening_stock: 1,
  stock_count: null,
  damaged_lost: -1,
  undone: null,
} as const satisfies Record<StockMovementType, StockDirection | null>;

/**
 * What `POST stock-movements` accepts. bought comes only from a parts payment
 * line, stock_count only from applying a count, undone only from /mistaken.
 */
export const POSTABLE_MOVEMENT_TYPES = [
  "used",
  "returned",
  "moved",
  "opening_stock",
  "damaged_lost",
] as const satisfies readonly PostableStockMovementType[];

const POSTABLE: ReadonlySet<string> = new Set(POSTABLE_MOVEMENT_TYPES);

export function isPostableMovementType(type: string): type is PostableStockMovementType {
  return POSTABLE.has(type);
}

export function fixedDirectionFor(type: StockMovementType): StockDirection | null {
  return FIXED_DIRECTION[type];
}

/** True for the two-sided layout (one movement, a source and a destination). */
export function isMoveType(type: StockMovementType): boolean {
  return type === "moved";
}

/** Serial-tracked parts need `serials[]` on the line for these. */
export function needsSerials(type: StockMovementType): boolean {
  return type === "used" || type === "returned" || type === "damaged_lost" || type === "moved";
}

/** Parses the API's direction, which may arrive as a number or a string. */
export function parseDirection(raw: number | string | null | undefined): StockDirection {
  const n = typeof raw === "number" ? raw : Number(raw);
  // Anything that is not an explicit -1 is treated as +1 rather than throwing:
  // a movement that fails to render is worse than one whose sign we default.
  return n === -1 ? -1 : 1;
}
