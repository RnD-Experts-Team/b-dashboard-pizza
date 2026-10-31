/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance — storage: stock counts (MAINTENANCE §5)               */
/*                                                                            */
/*  Locations, place levels, balances and the movement ledger keep their      */
/*  types in types/storage.types.ts (reworked there for the new movement       */
/*  types); this file adds what is new.                                */
/* ────────────────────────────────────────────────────────────────────────── */

import type { Decimal, IdName, IsoDateTime, Money } from "./common.types";
import type { PartMeasureUnit } from "./catalog.types";

export type {
  StockMovementType,
  PostableStockMovementType,
} from "@/types/storage.types";

export type StockCountStatus = "draft" | "applied";

export interface StockCountLine {
  id: number;
  /** Always sent; `part` can be null for a part deleted since. */
  partId: number;
  part: (IdName & { unit: PartMeasureUnit }) | null;
  /** The balance when the sheet was made (recomputed at apply time). */
  expected: Decimal;
  /** null = not counted yet. */
  counted: Decimal | null;
  /** counted − expected; null while not counted. */
  difference: Decimal | null;
  /** Average cost of one. */
  unitCost: Money | null;
  /** difference × unit cost. */
  valueDifference: Money | null;
}

export interface StockCountTotals {
  missingQuantity: Decimal;
  missingValue: Money;
  extraQuantity: Decimal;
  extraValue: Money;
  countedLines: number;
  totalLines: number;
}

export interface StockCount {
  id: number;
  storageLocation: IdName;
  storageLocationId?: number;
  /** When the count covers one place inside the location ("Shelf" › "S"). */
  storagePlaceValueId?: number | null;
  storagePlaceValue?: StockCountPlace | null;
  status: StockCountStatus;
  /** @deprecated the wire field is `notes_text` (see notesText). */
  notes?: string | null;
  /** The count's own free-text note (`notes_text`). */
  notesText?: string | null;
  startedAt?: IsoDateTime;
  appliedAt?: IsoDateTime | null;
  /** The user id (wire `created_by`); the name is on `creator`. */
  createdBy?: number | null;
  creator?: { id: number; name: string } | null;
  applier?: { id: number; name: string } | null;
  createdAt: IsoDateTime;
  updatedAt?: IsoDateTime;
  /** The stock_count movement written on apply. */
  stockMovementId?: number | null;
  /** On show; the list sends null. */
  lines?: StockCountLine[] | null;
  totals?: StockCountTotals;
}

/** The one place a count covers, as the API presents it. */
export interface StockCountPlace {
  id: number;
  value: string;
  levelId?: number | null;
  level?: string | null;
}

export interface StockCountFilters {
  storageLocationId?: number;
  status?: StockCountStatus;
  /** Up to 200 (server default 25). */
  perPage?: number;
}

/** One purchase of a part (GET parts/{part}/price-history), newest first, at most 50. */
export interface PartPriceEntry {
  storageLocationId: number;
  storageLocation: IdName | null;
  receivedAt: IsoDateTime;
  quantity: Decimal;
  unitCost: Money;
  totalCost: Money;
  stockMovementId: number;
}

/** A ticket issue found by the storage page's "Used on a ticket" search. */
export interface TicketIssueHit {
  id: number;
  ticketId: number;
  title: string;
  storeNumber: string | null;
  status: string | null;
}

export interface StartStockCountPayload {
  storageLocationId: number;
  storagePlaceValueId?: number | null;
}

/** PATCH stock-counts/{count}: also adds parts not on the sheet. Draft only. */
export interface SaveStockCountPayload {
  lines: { partId: number; counted: number | string | null }[];
  notes?: string | null;
}
