/**
 * The small "Record stock" dialogs (docs/MAINTENANCE-UI.md §6), as pure
 * logic: which fields each action shows, how its form is checked before it is
 * sent, and the exact `POST stock-movements` body it becomes.
 *
 * MAINTENANCE §5 / StoreStockMovementRequest:
 * - every line names a part, a location, a positive quantity and (sent always)
 *   its direction; a move is ONE movement with a −1 source line and a +1
 *   destination line;
 * - a serial-tracked part names one serial per piece (`serials[]`, count =
 *   quantity) — for a move the same serials go on both lines;
 * - `ticket_issue_id` only on `used`.
 *
 * Nothing here renders; problems come back as codes the dialog translates.
 */

import { format } from "date-fns";
import { nameKey } from "@/lib/maintenance/names";
import { parseDecimal } from "@/lib/maintenance/money";
import { fixedDirectionFor } from "@/lib/storage/movement-types";
import type { Part } from "@/types/maintenance-system";
import type {
  CreateStockMovementLinePayload,
  CreateStockMovementPayload,
  PostableStockMovementType,
  StockDirection,
  StockMovement,
} from "@/types/storage.types";

/* ── Places ("Zone A › Shelf S") ─────────────────────────────────────────── */

export const PLACE_SEPARATOR = " › ";

/** "Zone A › Shelf S" — each level's name with its value, in the server's order. */
export function placeLabel(place: readonly { level?: string | null; value: string }[] | null | undefined): string {
  return (place ?? [])
    .map((line) => (line.level ? `${line.level} ${line.value}` : line.value))
    .join(PLACE_SEPARATOR);
}

/* ── Parts ───────────────────────────────────────────────────────────────── */

/** True when the part's name, brand, model or part number contains `query` (case and spacing ignored). */
export function partMatches(part: Pick<Part, "name" | "brand" | "model" | "partNumber">, query: string): boolean {
  const q = nameKey(query);
  if (!q) return true;
  return [part.name, part.brand, part.model, part.partNumber].some((field) => nameKey(field).includes(q));
}

/** "Brand · Model · #PN" — the details that tell two similar parts apart. */
export function partHint(part: Pick<Part, "brand" | "model" | "partNumber">): string {
  return [part.brand, part.model, part.partNumber ? `#${part.partNumber}` : null].filter(Boolean).join(" · ");
}

/* ── Dates ───────────────────────────────────────────────────────────────── */

/** Now as the local `YYYY-MM-DDTHH:mm` the movement endpoint takes (no offset). */
export function nowLocalDateTime(at: Date = new Date()): string {
  return format(at, "yyyy-MM-dd'T'HH:mm");
}

/* ── What each action asks for ───────────────────────────────────────────── */

export type StockFlow = "out" | "in" | "both";

export interface StockActionShape {
  /** out = leaves a location, in = arrives at one, both = a move. */
  flow: StockFlow;
  /** `used`: which ticket issue. */
  needsIssue: boolean;
  /** Where it goes inside the (destination) location can be said. */
  offersSpot: boolean;
}

export const STOCK_ACTION_SHAPES = {
  used: { flow: "out", needsIssue: true, offersSpot: false },
  damaged_lost: { flow: "out", needsIssue: false, offersSpot: false },
  returned: { flow: "in", needsIssue: false, offersSpot: true },
  opening_stock: { flow: "in", needsIssue: false, offersSpot: true },
  moved: { flow: "both", needsIssue: false, offersSpot: true },
} as const satisfies Record<PostableStockMovementType, StockActionShape>;

export function shapeOf(type: PostableStockMovementType): StockActionShape {
  return STOCK_ACTION_SHAPES[type];
}

/* ── The form ────────────────────────────────────────────────────────────── */

export interface StockForm {
  partId: number | null;
  /** The location it leaves (out, move) or arrives at (in). */
  locationId: number | null;
  /** A move's destination. */
  toLocationId: number | null;
  /** Typed quantity; ignored for serial-tracked parts (the serials count). */
  quantity: string;
  serials: string[];
  ticketIssueId: number | null;
  /** The spot inside the destination, one value per level (optional). */
  placeValueIds: number[];
  movedAt: string;
  note: string;
}

export function emptyStockForm(prefill: { partId?: number | null; locationId?: number | null } = {}): StockForm {
  return {
    partId: prefill.partId ?? null,
    locationId: prefill.locationId ?? null,
    toLocationId: null,
    quantity: "1",
    serials: [],
    ticketIssueId: null,
    placeValueIds: [],
    movedAt: nowLocalDateTime(),
    note: "",
  };
}

/** True once something was typed or picked (the unsaved-changes guard). */
export function isStockFormDirty(form: StockForm, initial: StockForm): boolean {
  return (
    form.partId !== initial.partId ||
    form.locationId !== initial.locationId ||
    form.toLocationId !== initial.toLocationId ||
    form.quantity !== initial.quantity ||
    form.serials.length > 0 ||
    form.ticketIssueId !== initial.ticketIssueId ||
    form.placeValueIds.length > 0 ||
    form.note.trim() !== ""
  );
}

/** The quantity the movement carries: the serials picked, or the number typed. */
export function quantityOf(form: StockForm, trackSerials: boolean): number | null {
  if (trackSerials) return form.serials.length;
  return parseDecimal(form.quantity);
}

/* ── Checks before sending ───────────────────────────────────────────────── */

export type StockFormProblem =
  | "required"
  | "positive"
  | "notEnough"
  | "sameLocation"
  | "serialsNeeded"
  | "serialRepeated";

/** Keyed like the API's 422 bag, so client and server errors land on the same field. */
export type StockFormField = "part_id" | "storage_location_id" | "to_location_id" | "quantity" | "serials" | "ticket_issue_id" | "moved_at";

export type StockFormProblems = Partial<Record<StockFormField, StockFormProblem>>;

/** The order fields appear in, to focus the first one with a problem. */
export const STOCK_FORM_FIELD_ORDER: readonly StockFormField[] = [
  "part_id",
  "ticket_issue_id",
  "storage_location_id",
  "to_location_id",
  "quantity",
  "serials",
  "moved_at",
];

export function validateStockForm(
  type: PostableStockMovementType,
  form: StockForm,
  ctx: { trackSerials: boolean; available: number | null },
): StockFormProblems {
  const shape = shapeOf(type);
  const problems: StockFormProblems = {};
  if (form.partId == null) problems.part_id = "required";
  if (form.locationId == null) problems.storage_location_id = "required";
  if (shape.flow === "both") {
    if (form.toLocationId == null) problems.to_location_id = "required";
    else if (form.toLocationId === form.locationId) problems.to_location_id = "sameLocation";
  }
  if (shape.needsIssue && form.ticketIssueId == null) problems.ticket_issue_id = "required";
  if (!form.movedAt) problems.moved_at = "required";

  const qty = quantityOf(form, ctx.trackSerials);
  if (ctx.trackSerials) {
    const tidy = form.serials.map((s) => s.trim()).filter(Boolean);
    if (tidy.length === 0) problems.serials = "serialsNeeded";
    else if (new Set(tidy).size !== tidy.length) problems.serials = "serialRepeated";
  } else if (qty == null || qty <= 0) {
    problems.quantity = "positive";
  }
  // Advisory, like the server's own check: the authoritative one is upstream.
  if (shape.flow !== "in" && qty != null && qty > 0 && ctx.available != null && qty > ctx.available) {
    problems[ctx.trackSerials ? "serials" : "quantity"] = "notEnough";
  }
  return problems;
}

/* ── The request body ────────────────────────────────────────────────────── */

const OUT: StockDirection = -1;
const IN: StockDirection = 1;

/**
 * The `POST stock-movements` body for one dialog. Call only after
 * validateStockForm came back empty.
 */
export function buildStockMovementPayload(
  type: PostableStockMovementType,
  form: StockForm,
  trackSerials: boolean,
): CreateStockMovementPayload {
  const partId = form.partId as number;
  const quantity = quantityOf(form, trackSerials) ?? 0;
  const serials = trackSerials ? form.serials.map((s) => s.trim()).filter(Boolean) : undefined;
  const line = (storageLocationId: number, direction: StockDirection): CreateStockMovementLinePayload => ({
    part_id: partId,
    storage_location_id: storageLocationId,
    quantity,
    direction,
    ...(serials ? { serials } : {}),
  });

  const lines =
    shapeOf(type).flow === "both"
      ? [line(form.locationId as number, OUT), line(form.toLocationId as number, IN)]
      : [line(form.locationId as number, fixedDirectionFor(type) ?? IN)];

  const note = form.note.trim();
  return {
    moved_at: form.movedAt,
    type,
    ...(type === "used" && form.ticketIssueId != null ? { ticket_issue_id: form.ticketIssueId } : {}),
    lines,
    ...(note ? { notes: [{ body: note }] } : {}),
  };
}

/** The location whose spot can be set afterwards (the destination), or null. */
export function spotLocationOf(type: PostableStockMovementType, form: StockForm): number | null {
  const shape = shapeOf(type);
  if (!shape.offersSpot || form.placeValueIds.length === 0) return null;
  return shape.flow === "both" ? form.toLocationId : form.locationId;
}

/* ── Reading a movement back for the ledger ──────────────────────────────── */

export interface MovementSummary {
  /** Distinct parts, in line order. */
  parts: { id: number; name: string; quantity: number }[];
  /** Where stock left from / arrived at (names), deduplicated. */
  from: string[];
  to: string[];
  serials: string[];
}

export function summarizeMovement(movement: Pick<StockMovement, "lines">): MovementSummary {
  const parts = new Map<number, { id: number; name: string; quantity: number }>();
  const from = new Set<string>();
  const to = new Set<string>();
  const serials: string[] = [];
  (movement.lines ?? []).forEach((line) => {
    const name = line.part?.name ?? `#${line.partId}`;
    const where = line.storageLocation?.name ?? `#${line.storageLocationId}`;
    (line.direction < 0 ? from : to).add(where);
    serials.push(...line.serials);
    const existing = parts.get(line.partId);
    // A move has a −1 and a +1 line for the same pieces: count them once.
    if (existing) existing.quantity = Math.max(existing.quantity, line.quantity);
    else parts.set(line.partId, { id: line.partId, name, quantity: line.quantity });
  });
  return { parts: [...parts.values()], from: [...from], to: [...to], serials: [...new Set(serials)] };
}

/** Whether "Mark as mistake" applies: not already undone, not an undo itself, not a payment's purchase. */
export function canMarkMovementMistaken(movement: Pick<StockMovement, "mistaken" | "type" | "payment">): boolean {
  if (movement.mistaken) return false;
  if (movement.type.value === "undone") return false;
  // Parts bought on a payment are undone with the payment (server 422 otherwise).
  if (movement.type.value === "bought" && movement.payment) return false;
  return true;
}
