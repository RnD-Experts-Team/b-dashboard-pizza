/**
 * What people actually do to stock, in the words they would use.
 *
 * The API has seven postable movement types and a +1/-1 direction, and that
 * vocabulary is correct for a ledger and wrong for a person. Nobody walks into
 * a store room thinking "transfer_out". They think: some parts arrived, some
 * went out on a job, some came back, some moved to the van.
 *
 * So this is a thin translation layer, not a new model. Each action maps onto
 * exactly one existing movement type; `lib/storage/movement-types.ts` remains
 * the single source of truth for direction, and nothing here can invent one.
 *
 * Storage is new enough that we get to choose this vocabulary rather than
 * inherit it -- so the words purchase, draw, transfer_in and the +1/-1 concept
 * never reach the screen.
 */

import type { PostableStockMovementType } from "@/types/storage.types";

export type StockActionId =
  | "received"
  | "usedOnJob"
  | "cameBack"
  | "movedBetween"
  | "fixCount";

export interface StockAction {
  id: StockActionId;
  /** The button. What happened, in the past tense, because it already did. */
  label: string;
  /** One line under it. Says which real-world moment this is. */
  description: string;
  /** Lucide icon name; resolved by the component so this stays React-free. */
  icon: string;
  /**
   * The movement type this posts as. `null` for the two that need the user to
   * say more before a type can be chosen -- a correction can go either way.
   */
  movementType: PostableStockMovementType | null;
  /** Renders the two-location layout. */
  isTransfer?: boolean;
  /** Each line states its own direction, because the point is that some go up
   *  and some go down. */
  needsPerLineDirection?: boolean;
}

export const STOCK_ACTIONS: StockAction[] = [
  {
    id: "received",
    label: "Parts came in",
    description: "Bought, delivered, or counted onto a shelf for the first time.",
    icon: "PackagePlus",
    movementType: "purchase",
  },
  {
    id: "usedOnJob",
    label: "Parts went out for a job",
    description: "Taken off a shelf to fix something.",
    icon: "PackageMinus",
    movementType: "draw",
  },
  {
    id: "cameBack",
    label: "Parts came back",
    description: "Not needed after all, and back on the shelf.",
    icon: "Undo2",
    movementType: "return",
  },
  {
    id: "movedBetween",
    label: "Parts moved somewhere else",
    description: "Off one shelf and onto another. Nothing was used.",
    icon: "ArrowLeftRight",
    // One movement with a -1 line at the source and a +1 at the destination.
    // The composer already builds both sides; the user names two places, not
    // two movements.
    movementType: "transfer_out",
    isTransfer: true,
  },
  {
    id: "fixCount",
    label: "The count was wrong",
    description: "The shelf does not match the system. Say what is really there.",
    icon: "Calculator",
    movementType: "adjustment",
    needsPerLineDirection: true,
  },
];

export function actionById(id: StockActionId): StockAction {
  const found = STOCK_ACTIONS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown stock action: ${id}`);
  return found;
}

/**
 * Which action a recorded movement came from, for reading the ledger back.
 *
 * `initial_count` folds into "came in" and `reversal` into "was corrected",
 * because on a history row the distinction that matters to a reader is what
 * happened to the stock, not which enum value was posted. The raw type is still
 * on the record for anyone who needs it.
 */
export const MOVEMENT_TYPE_PLAIN: Record<string, string> = {
  purchase: "Came in",
  initial_count: "Came in",
  draw: "Went out for a job",
  return: "Came back",
  transfer_out: "Moved out",
  transfer_in: "Moved in",
  adjustment: "Count corrected",
  reversal: "Undone",
};

export function plainMovementLabel(type: string): string {
  return MOVEMENT_TYPE_PLAIN[type] ?? type;
}
