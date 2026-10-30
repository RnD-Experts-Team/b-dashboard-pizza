/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2 — shared scalars and small references                     */
/*                                                                            */
/*  Mirrors MaintenancePizza/docs/MAINTENANCE-V2.md. Wire keys are snake_case; */
/*  the services camelCase every key (lib/api/maintenance-v2/http.ts), so the */
/*  types here are the camelCase reading of the contract, field for field.    */
/*                                                                            */
/*  Money and hours stay STRINGS with 2 decimals, exactly as the API sends    */
/*  them ("1234.50", "3.25"): parse them with lib/maintenance/money.ts when   */
/*  you need arithmetic, never parseFloat().toFixed() inline.                */
/* ────────────────────────────────────────────────────────────────────────── */

import type { TicketAttachment, TicketNote } from "@/types/maintenance-tickets.types";

export type { TicketAttachment, TicketNote };

/** A decimal string with 2 places: "1234.50". */
export type Money = string;
/** A decimal string with 2 places: "3.25" (hours) or "12.00" (quantity). */
export type Decimal = string;
/** ISO-8601 datetime. */
export type IsoDateTime = string;
/** `YYYY-MM-DD`. */
export type IsoDate = string;
/** `HH:mm`. */
export type ClockTime = string;

/**
 * An enum as the dashboard holds it: the value to send back plus the server's
 * own label. The services build it whether the API sent `{value,label}` or a
 * bare string next to a `*_label` key.
 */
export interface MEnum<T extends string = string> {
  value: T;
  label: string;
}

export interface IdName {
  id: number;
  name: string;
}

export interface StoreRef {
  id: number;
  storeNumber: string;
}

/** The issue reference carried by payment lines, purchases and part units. */
export interface IssueRef {
  id: number;
  ticketId: number;
  title: string;
  storeNumber: string | null;
}

/** Laravel's paginator meta, camelCased. */
export interface PageMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface Page<T, M extends PageMeta = PageMeta> {
  data: T[];
  meta: M;
}

/** Files and a note on anything that takes them. */
export interface WithFiles {
  files?: File[];
}

/** A reason, required by every dashboard correction. */
export interface ReasonPayload {
  reason: string;
}

/** Notes/attachments every catalog-ish row may carry when loaded. */
export interface WithNotesAndFiles {
  notes?: TicketNote[];
  attachments?: TicketAttachment[];
}
