/**
 * The "Record stock" menu on the Storage page (docs/MAINTENANCE-V2-UI.md §6),
 * in the words people use. Each entry maps onto ONE v2 movement type, or —
 * for parts bought — onto the payment dialog with a parts line to storage,
 * because a Bought movement only ever comes from a payment.
 *
 * Labels are i18n keys under `maintenanceV2.stock.actions.*` with an English
 * fallback; icons are lucide names resolved by the component, so this file
 * stays React-free.
 */

import type { PostableStockMovementType } from "@/types/storage.types";

export type StockActionId = "bought" | "used" | "returned" | "moved" | "opening_stock" | "damaged_lost";

export interface StockAction {
  id: StockActionId;
  /** i18n key (maintenanceV2.stock.actions.<id>.label / .help). */
  labelKey: string;
  helpKey: string;
  label: string;
  help: string;
  /** lucide-react icon name. */
  icon: string;
  /** The movement it posts; null = opens the payment dialog instead. */
  movementType: PostableStockMovementType | null;
  /** `used`: pick the ticket issue it went to. */
  needsTicketIssue?: boolean;
  /** `moved`: a source and a destination. */
  twoLocations?: boolean;
}

const key = (id: StockActionId) => `maintenanceV2.stock.actions.${id}`;

export const STOCK_ACTIONS = [
  {
    id: "bought",
    labelKey: `${key("bought")}.label`,
    helpKey: `${key("bought")}.help`,
    label: "Parts bought",
    help: "Recorded as a payment with a parts line going into storage.",
    icon: "ShoppingCart",
    movementType: null,
  },
  {
    id: "used",
    labelKey: `${key("used")}.label`,
    helpKey: `${key("used")}.help`,
    label: "Used on a ticket",
    help: "Taken off the shelf to fix something on a ticket.",
    icon: "Wrench",
    movementType: "used",
    needsTicketIssue: true,
  },
  {
    id: "returned",
    labelKey: `${key("returned")}.label`,
    helpKey: `${key("returned")}.help`,
    label: "Returned",
    help: "Not needed after all, and back on the shelf.",
    icon: "Undo2",
    movementType: "returned",
  },
  {
    id: "moved",
    labelKey: `${key("moved")}.label`,
    helpKey: `${key("moved")}.help`,
    label: "Moved",
    help: "From one place to another. Nothing was used.",
    icon: "ArrowLeftRight",
    movementType: "moved",
    twoLocations: true,
  },
  {
    id: "opening_stock",
    labelKey: `${key("opening_stock")}.label`,
    helpKey: `${key("opening_stock")}.help`,
    label: "Opening stock",
    help: "What was already on the shelf before we started counting.",
    icon: "PackageOpen",
    movementType: "opening_stock",
  },
  {
    id: "damaged_lost",
    labelKey: `${key("damaged_lost")}.label`,
    helpKey: `${key("damaged_lost")}.help`,
    label: "Damaged or lost",
    help: "Broken, thrown away, or cannot be found.",
    icon: "PackageX",
    movementType: "damaged_lost",
  },
] as const satisfies readonly StockAction[];

export function stockActionById(id: StockActionId): StockAction {
  const found = STOCK_ACTIONS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown stock action: ${id}`);
  return found;
}
