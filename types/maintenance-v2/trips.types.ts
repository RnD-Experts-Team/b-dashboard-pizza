/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2 — trips (clocking) (MAINTENANCE-V2 §3)                     */
/* ────────────────────────────────────────────────────────────────────────── */

import type {
  Decimal,
  IdName,
  IsoDate,
  IsoDateTime,
  StoreRef,
  TicketAttachment,
  TicketNote,
  WithFiles,
} from "./common.types";
import type { TechnicianPurchase } from "./payments.types";
import type { IssueStatus, Priority, SchedulePurpose, TripLinkIssued, VisitTaskStatus } from "./workflow.types";

export type TripStatus = "open" | "closed";

/** `App\Enums\TripEventKind`. Clock in/out are the session itself. */
export type TripEventKind =
  | "break_start"
  | "break_end"
  | "travel_start"
  | "travel_end"
  | "parts_run_start"
  | "parts_run_end";

export type TripStopStatus = "planned" | "arrived" | "done" | "not_done";
export type SessionSource = "technician" | "specialist" | "migrated";

/** The technician's state, on the public trip page. */
export type TripState = "off_clock" | "on_clock" | "on_break" | "travelling" | "parts_run";

/** Minutes per kind of time in one session. paid = work + travel + parts run. */
export interface SessionDurations {
  work: number;
  travel: number;
  partsRun: number;
  break: number;
  paid: number;
}

export interface TripLinkStatus {
  active: boolean;
  expiresAt: IsoDateTime | null;
  lastUsedAt: IsoDateTime | null;
  /** Hours of no use after which the link stops working. */
  idleHours?: number | null;
}

export interface TripTotals {
  paidMinutes: number;
  breakMinutes: number;
  miles: Decimal | number | null;
}

export interface TripStopIssue {
  ticketIssueId: number;
  ticketId: number;
  title: string;
  status: IssueStatus;
  priority: Priority;
  purpose: SchedulePurpose;
  taskStatus: VisitTaskStatus;
  doneAt: IsoDateTime | null;
  notDoneReason: string | null;
  description?: string | null;
  statusLabel?: string | null;
}

export interface TripStop {
  id: number;
  store: StoreRef | null;
  otherStore: string | null;
  status: TripStopStatus;
  arrivedAt: IsoDateTime | null;
  leftAt: IsoDateTime | null;
  arrivalOdometer: Decimal | number | null;
  notDoneReason: string | null;
  attachments: TicketAttachment[];
  issues: TripStopIssue[];
  mistaken?: boolean;
  /** Notes on this visit (the technician's are never private). */
  notes?: TicketNote[] | null;
  sortOrder?: number | null;
}

export interface TripEvent {
  id: number;
  kind: TripEventKind;
  label: string;
  at: IsoDateTime;
  mistaken: boolean;
}

export interface TripSession {
  id: number;
  clockIn: IsoDateTime;
  clockOut: IsoDateTime | null;
  usingCar: boolean;
  odometerIn: Decimal | number | null;
  odometerOut: Decimal | number | null;
  miles: Decimal | number | null;
  source: SessionSource;
  mistaken: boolean;
  /** Claimed by a payment line. */
  paid: boolean;
  paymentId: number | null;
  durations: SessionDurations;
  events: TripEvent[];
  attachments: TicketAttachment[];
}

/** One dashboard edit, before/after (on show only). */
export interface TripAudit {
  id: number;
  action?: string | null;
  subjectType?: string | null;
  subjectId?: number | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  user: IdName | null;
  createdAt: IsoDateTime;
}

export interface Trip {
  id: number;
  technician: { id: number; name: string; phone: string | null };
  status: TripStatus;
  plannedDate: IsoDate;
  instructions: string | null;
  link: TripLinkStatus;
  onClock: boolean;
  openSessionId: number | null;
  /** What he is doing now (TripService::state, the link's reading) — on list rows and show. */
  state?: TripState;
  totals: TripTotals;
  stops: TripStop[];
  sessions: TripSession[];
  purchases: TechnicianPurchase[];
  notes: TicketNote[];
  attachments: TicketAttachment[];
  /** On show only. */
  audits?: TripAudit[];
  mistaken?: boolean;
  closedAt?: IsoDateTime | null;
  statusLabel?: string | null;
  createdAt: IsoDateTime;
}

/** POST trips / POST trips/{t}/link: the trip and a NEW link (shown once). */
export interface TripWithLink {
  trip: Trip;
  tripLink: TripLinkIssued | null;
}

export interface TripFilters {
  status?: TripStatus;
  technicianId?: number;
  from?: IsoDate;
  to?: IsoDate;
  onClock?: boolean;
  search?: string;
  page?: number;
  perPage?: number;
}

/**
 * A stop as created. `storeId` is the store as the dashboard knows it; the
 * contract does not say whether it is the store number or the row id (see
 * the foundation report) — the services send whatever the caller passes.
 */
export interface TripStopInput {
  storeId?: string | number;
  otherStore?: string;
  ticketIssueIds: number[];
  purpose?: SchedulePurpose;
}

export interface CreateTripPayload {
  technicianId: number;
  plannedDate: IsoDate;
  instructions?: string | null;
  stops?: TripStopInput[];
}

export interface UpdateTripPayload {
  plannedDate?: IsoDate;
  instructions?: string | null;
  linkIdleHours?: number | null;
}

export interface AddSessionPayload {
  clockIn: IsoDateTime;
  clockOut?: IsoDateTime | null;
  usingCar?: boolean;
  odometerIn?: number | null;
  odometerOut?: number | null;
  reason: string;
}

export interface UpdateSessionPayload {
  clockIn?: IsoDateTime;
  clockOut?: IsoDateTime | null;
  usingCar?: boolean;
  odometerIn?: number | null;
  odometerOut?: number | null;
  reason: string;
}

export interface AddEventPayload {
  kind: TripEventKind;
  at: IsoDateTime;
  reason: string;
}

export interface UpdateEventPayload {
  at: IsoDateTime;
  reason: string;
}

/** A closed, unclaimed session (GET trip-sessions/unpaid, unpaid-work). */
export interface UnpaidSession {
  id: number;
  tripId: number;
  technician?: IdName;
  clockIn: IsoDateTime;
  clockOut: IsoDateTime | null;
  usingCar?: boolean;
  miles?: Decimal | number | null;
  durations: SessionDurations;
  /** The ticket issues of the trip's stops. */
  ticketIssues: { id: number; ticketId: number; title: string; storeNumber: string | null }[];
}

/* ── Public (technician) trip page ───────────────────────────────────────── */

/** GET public/trips/{token}: the trip minus audits/private notes, plus state and stores. */
export interface PublicTrip extends Omit<Trip, "audits"> {
  state: TripState;
  /** Stores he can add a stop for. */
  stores: StoreRef[];
  /** Off the clock here but clocked in on another trip (clock in is refused until he clocks out there). */
  clockedInElsewhere?: boolean;
}

export interface ClockInPayload {
  usingCar?: boolean;
  odometer?: number | null;
  photo?: File | null;
}

export interface ClockOutPayload {
  odometer?: number | null;
  photo?: File | null;
}

export interface PublicEventPayload {
  kind: TripEventKind;
}

export interface PublicAddStopPayload {
  storeId: number | string;
}

export interface ArrivePayload {
  odometer?: number | null;
  photo?: File | null;
}

export interface PublicNotDonePayload {
  reason: string;
}

export interface PublicIssueDonePayload extends WithFiles {
  /** Job photos, stored on the issue as "Before - …" / "After - …" and read back as attachment `kind`. */
  before?: File[];
  after?: File[];
  note?: string | null;
  /** Inspection visits: what he found and the quote. */
  findings?: string | null;
  estimatedCost?: string | number | null;
}

export interface PublicPurchasePayload {
  description: string;
  partId?: number | null;
  quantity?: number | null;
  totalCost: string | number;
  /** One of supplierId (known) or supplierName (new, created upstream). */
  supplierId?: number | null;
  supplierName?: string | null;
  ticketIssueId?: number | null;
  serialNumber?: string | null;
  receipt?: File[];
}

export interface PublicNotePayload extends WithFiles {
  body: string;
  stopId?: number | null;
}

/**
 * A public-page failure, in the terms the page shows: an expired link (410),
 * an unknown one (404), or something to retry.
 */
export type TripPortalErrorKind = "expired" | "not_found" | "network" | "validation" | "rate_limited" | "server";
