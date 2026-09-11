/* ────────────────────────────────────────────────────────────────────────── */
/*  Movement types and their directions — ONE source of truth                */
/*                                                                            */
/*  Pure, non-React. The composer derives its option list from this table, so */
/*  the two can never drift apart.                                           */
/* ────────────────────────────────────────────────────────────────────────── */

import type {
  PostableStockMovementType,
  StockDirection,
  StockMovementType,
} from "@/types/storage.types";

/**
 * Direction per movement type.
 *
 * `null` means the type does NOT fix a direction — every line must state its
 * own (that is `adjustment`, where the whole point is that some lines go up
 * and some go down).
 *
 * Keyed by PostableStockMovementType, which buys two things:
 *   - `reversal` CANNOT be a key. The backend writes those; posting one is
 *     refused, so it is excluded at the type level rather than only hidden in
 *     a dropdown.
 *   - a new postable type is a COMPILE ERROR until its direction is declared.
 */
export const FIXED_DIRECTION: Record<PostableStockMovementType, StockDirection | null> = {
  purchase: 1,
  return: 1,
  transfer_in: 1,
  initial_count: 1,
  draw: -1,
  transfer_out: -1,
  adjustment: null,
};

/**
 * The composer's option list. DERIVED from the table above rather than written
 * out again, so a type can never appear in the dropdown without a direction.
 */
export const POSTABLE_MOVEMENT_TYPES = Object.keys(
  FIXED_DIRECTION
) as PostableStockMovementType[];

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  purchase: "Purchase",
  draw: "Draw",
  return: "Return",
  transfer_out: "Transfer out",
  transfer_in: "Transfer in",
  adjustment: "Adjustment",
  initial_count: "Initial count",
  reversal: "Reversal",
};

export const MOVEMENT_TYPE_HINTS: Record<PostableStockMovementType, string> = {
  purchase: "Bought into a location",
  draw: "Taken for a job",
  return: "Came back to a shelf",
  transfer_out: "Moved between locations",
  transfer_in: "Moved between locations",
  adjustment: "Correcting a count — each line states its own direction",
  initial_count: "Opening stock",
};

export function fixedDirectionFor(
  type: PostableStockMovementType
): StockDirection | null {
  return FIXED_DIRECTION[type];
}

/** True for the two-sided transfer layout (one movement, two locations). */
export function isTransferType(type: PostableStockMovementType): boolean {
  return type === "transfer_out" || type === "transfer_in";
}

/** "+ In" / "− Out", for the read-only direction chip. */
export function directionLabel(direction: StockDirection): string {
  return direction === 1 ? "+ In" : "− Out";
}

/** Parses the API's direction, which may arrive as a number or a string. */
export function parseDirection(raw: number | string | null | undefined): StockDirection {
  const n = typeof raw === "number" ? raw : Number(raw);
  // Anything that is not an explicit -1 is treated as +1 rather than throwing:
  // a movement that fails to render is worse than one whose sign we default.
  return n === -1 ? -1 : 1;
}
