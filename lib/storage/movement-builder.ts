/* ────────────────────────────────────────────────────────────────────────── */
/*  Composer form state → request payload(s)                                 */
/*                                                                            */
/*  Pure, non-React. All payload construction lives here so the rules that    */
/*  carry stock consequences can be read end to end without JSX.             */
/* ────────────────────────────────────────────────────────────────────────── */

import { FIXED_DIRECTION, isTransferType } from "./movement-types";
import type {
  CreateStockMovementLinePayload,
  CreateStockMovementPayload,
  PostableStockMovementType,
  StockDirection,
  StockPaidBy,
} from "@/types/storage.types";

export interface ComposerRow {
  /** Stable local id, so errors can be mapped back to a row the user sees. */
  rowId: string;
  partId: string;
  storageLocationId: string;
  quantity: string;
  unitCost: string;
  /**
   * Only used when the movement type fixes no direction (`adjustment`).
   * Deliberately starts UNSET — defaulting to +1 silently invents stock and
   * -1 silently destroys it.
   */
  direction: StockDirection | null;
}

export interface ComposerForm {
  movedAt: string;
  type: PostableStockMovementType;
  paidBy: StockPaidBy | "";
  paidByTechnicianId: string;
  noteBody: string;
  rows: ComposerRow[];
  /** Transfer layout only. */
  fromLocationId: string;
  toLocationId: string;
}

export function emptyRow(rowId: string): ComposerRow {
  return {
    rowId,
    partId: "",
    storageLocationId: "",
    quantity: "",
    unitCost: "",
    direction: null,
  };
}

export function emptyComposerForm(movedAt: string): ComposerForm {
  return {
    movedAt,
    type: "purchase",
    paidBy: "",
    paidByTechnicianId: "",
    noteBody: "",
    rows: [emptyRow("r0")],
    fromLocationId: "",
    toLocationId: "",
  };
}

function num(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** A row the user has not touched at all — safe to drop silently. */
export function isBlankRow(row: ComposerRow): boolean {
  return (
    !row.partId.trim() &&
    !row.storageLocationId.trim() &&
    !row.quantity.trim() &&
    !row.unitCost.trim()
  );
}

/** A row with everything the payload needs. */
export function isCompleteRow(row: ComposerRow, form: ComposerForm): boolean {
  if (!num(row.partId)) return false;
  const qty = num(row.quantity);
  if (qty == null || qty <= 0) return false;
  if (isTransferType(form.type)) {
    // Locations come from the header in transfer mode.
    return !!num(form.fromLocationId) && !!num(form.toLocationId);
  }
  if (!num(row.storageLocationId)) return false;
  if (FIXED_DIRECTION[form.type] === null && row.direction == null) return false;
  return true;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Validation — keys are rowId-scoped so errors land on the right row       */
/* ────────────────────────────────────────────────────────────────────────── */

export function rowErrorKey(rowId: string, field: string): string {
  return `row:${rowId}:${field}`;
}

export function validateComposer(form: ComposerForm): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.movedAt.trim()) errors.moved_at = "When did this happen?";
  if (form.paidBy === "technician" && !num(form.paidByTechnicianId)) {
    errors.paid_by_technician_id = "Pick who paid.";
  }

  const transfer = isTransferType(form.type);
  if (transfer) {
    const from = num(form.fromLocationId);
    const to = num(form.toLocationId);
    if (!from) errors.from_location = "Pick where the stock is coming from.";
    if (!to) errors.to_location = "Pick where it is going.";
    if (from && to && from === to) {
      errors.to_location = "Source and destination must differ.";
    }
  }

  const touched = form.rows.filter((r) => !isBlankRow(r));
  if (touched.length === 0) {
    errors.lines = "Add at least one line.";
  }

  const needsPerLineDirection = FIXED_DIRECTION[form.type] === null;

  for (const row of touched) {
    if (!num(row.partId)) errors[rowErrorKey(row.rowId, "part")] = "Pick a part.";
    const qty = num(row.quantity);
    if (qty == null || qty <= 0) {
      errors[rowErrorKey(row.rowId, "quantity")] = "Enter an amount above zero.";
    }
    if (!transfer && !num(row.storageLocationId)) {
      errors[rowErrorKey(row.rowId, "location")] = "Pick a location.";
    }
    // An unset direction BLOCKS submit. It must never cause the row to be
    // filtered out instead — a dropped row is a 201 with missing data.
    if (needsPerLineDirection && row.direction == null) {
      errors[rowErrorKey(row.rowId, "direction")] = "In or out?";
    }
    const cost = row.unitCost.trim() ? num(row.unitCost) : null;
    if (row.unitCost.trim() && cost == null) {
      errors[rowErrorKey(row.rowId, "unitCost")] = "Enter a valid number.";
    }
  }

  return errors;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Building                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Maps a payload line index back to the UI row (and side) that produced it. */
export interface LineOrigin {
  rowId: string;
  /** Transfer only: which half of the pair this line is. */
  side?: "from" | "to";
}

export interface BuiltMovement {
  /**
   * ONE element today.
   *
   * If the backend turns out to require a transfer to be two movements
   * (`transfer_out` then `transfer_in`) rather than one movement carrying both
   * a −1 and a +1 line, this returns TWO and the submit handler's existing
   * loop posts them in sequence. Nothing else in the composer changes — that
   * is the whole reason this seam exists.
   */
  payloads: CreateStockMovementPayload[];
  /** Parallel to payloads: lineOrigins[i][j] describes payloads[i].lines[j]. */
  lineOrigins: LineOrigin[][];
}

export function buildMovementRequests(form: ComposerForm): BuiltMovement {
  // Filter FIRST, then build. appendDeep indexes by ARRAY POSITION, so a hole
  // in lines[] is silently dropped upstream — a 201 with missing lines, not an
  // error. Validation has already blocked any row that is touched but
  // incomplete, so only wholly untouched rows disappear here.
  const rows = form.rows.filter((r) => !isBlankRow(r) && isCompleteRow(r, form));

  const fixed = FIXED_DIRECTION[form.type];
  const lines: CreateStockMovementLinePayload[] = [];
  const origins: LineOrigin[] = [];

  if (isTransferType(form.type)) {
    const fromId = Number(form.fromLocationId);
    const toId = Number(form.toLocationId);
    for (const row of rows) {
      const base = {
        part_id: Number(row.partId),
        quantity: Number(row.quantity),
        ...(row.unitCost.trim() ? { unit_cost: Number(row.unitCost) } : {}),
      };
      // Source then destination, appended in order so indexes stay contiguous.
      lines.push({ ...base, storage_location_id: fromId, direction: -1 });
      origins.push({ rowId: row.rowId, side: "from" });
      lines.push({ ...base, storage_location_id: toId, direction: 1 });
      origins.push({ rowId: row.rowId, side: "to" });
    }
  } else {
    for (const row of rows) {
      // Direction is sent on EVERY line for EVERY type. Harmless when the type
      // already fixes it, and the only shape that works if a transfer really
      // is one movement carrying both directions.
      const direction: StockDirection = fixed ?? row.direction ?? 1;
      lines.push({
        part_id: Number(row.partId),
        storage_location_id: Number(row.storageLocationId),
        quantity: Number(row.quantity),
        ...(row.unitCost.trim() ? { unit_cost: Number(row.unitCost) } : {}),
        direction,
      });
      origins.push({ rowId: row.rowId });
    }
  }

  const payload: CreateStockMovementPayload = {
    moved_at: form.movedAt,
    type: form.type,
    ...(form.paidBy ? { paid_by: form.paidBy } : {}),
    ...(form.paidBy === "technician" && form.paidByTechnicianId
      ? { paid_by_technician_id: Number(form.paidByTechnicianId) }
      : {}),
    lines,
    ...(form.noteBody.trim() ? { notes: [{ body: form.noteBody.trim() }] } : {}),
  };

  return { payloads: [payload], lineOrigins: [origins] };
}

/**
 * Net movement per location, for the live preview.
 *
 * For a transfer this reads `Shelf A −12 · Shelf B +12 · Net 0`, so a
 * half-built transfer is visible before it is submitted rather than after.
 */
export function previewNetByLocation(built: BuiltMovement): Map<number, number> {
  const out = new Map<number, number>();
  for (const payload of built.payloads) {
    for (const line of payload.lines) {
      out.set(
        line.storage_location_id,
        (out.get(line.storage_location_id) ?? 0) + line.quantity * line.direction
      );
    }
  }
  return out;
}

/**
 * Resolves a server error key like `lines.0.quantity` back to the UI row.
 *
 * The index refers to the BUILT array, which for a transfer has twice as many
 * entries as there are rows on screen. Returns null when the key does not
 * match or the index is out of range — the caller then renders it at form
 * level rather than dropping it.
 */
export function resolveLineError(
  key: string,
  built: BuiltMovement
): { origin: LineOrigin; field: string } | null {
  const match = /^lines\.(\d+)\.(.+)$/.exec(key);
  if (!match) return null;
  const index = Number(match[1]);
  const origins = built.lineOrigins[0] ?? [];
  const origin = origins[index];
  if (!origin) return null;
  return { origin, field: match[2] };
}
