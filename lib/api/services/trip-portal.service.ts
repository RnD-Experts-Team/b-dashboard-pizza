/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance — the technician's trip page (public, no login, §3)       */
/*                                                                            */
/*  Everything goes to /api/public/maintenance-trips/{token}/… with NO       */
/*  Authorization header — the token in the link is the credential.          */
/*  Upstream answers 404 for an unknown token and 410 for an expired/closed  */
/*  one; both surface as a MaintenanceTicketsError (codes NOT_FOUND / GONE), */
/*  which portalErrorKind() turns into what the page shows.                  */
/*                                                                            */
/*  Every call returns the refreshed public trip (state included).           */
/* ────────────────────────────────────────────────────────────────────────── */

import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { http, PUBLIC_TRIPS_API, seg, type RequestOptions } from "@/lib/api/maintenance-system/http";
import type {
  ArrivePayload,
  ClockInPayload,
  ClockOutPayload,
  IdName,
  PublicAddStopPayload,
  PublicEventPayload,
  PublicIssueDonePayload,
  PublicNotDonePayload,
  PublicNotePayload,
  PublicPurchasePayload,
  PublicTrip,
  TripPortalErrorKind,
} from "@/types/maintenance-system";

const PUBLIC: Pick<RequestOptions, "auth" | "base"> = { auth: false, base: PUBLIC_TRIPS_API };

const root = (token: string) => `/${seg(token)}`;
const stopPath = (token: string, stopId: number) => `${root(token)}/stops/${seg(stopId)}`;
const stopIssuePath = (token: string, stopId: number, ticketIssueId: number) =>
  `${stopPath(token, stopId)}/issues/${seg(ticketIssueId)}`;

const post = (path: string, body: object = {}) => http.post<PublicTrip>(path, body, PUBLIC);

/** What the page should show for a failure. */
export function portalErrorKind(err: unknown): TripPortalErrorKind {
  if (!(err instanceof MaintenanceTicketsError)) return "server";
  const byCode: Partial<Record<MaintenanceTicketsError["code"], TripPortalErrorKind>> = {
    GONE: "expired",
    NOT_FOUND: "not_found",
    NETWORK_ERROR: "network",
    TIMEOUT: "network",
    VALIDATION_ERROR: "validation",
    RATE_LIMITED: "rate_limited",
  };
  return byCode[err.code] ?? "server";
}

export const tripPortalService = {
  /** Opening the link counts as use (keeps it alive). */
  getTrip(token: string, signal?: AbortSignal): Promise<PublicTrip> {
    return http.get<PublicTrip>(root(token), { ...PUBLIC, signal });
  },
  /** Refused when he is already clocked in anywhere. */
  clockIn: (token: string, payload: ClockInPayload = {}) => post(`${root(token)}/clock-in`, payload),
  /** Closes any open break/driving/parts run first. */
  clockOut: (token: string, payload: ClockOutPayload = {}) => post(`${root(token)}/clock-out`, payload),
  /** Start/end a break, driving, or a parts run; `at` is now. */
  addEvent: (token: string, payload: PublicEventPayload) => post(`${root(token)}/events`, payload),

  addStop: (token: string, payload: PublicAddStopPayload) => post(`${root(token)}/stops`, payload),
  arrive: (token: string, stopId: number, payload: ArrivePayload = {}) => post(`${stopPath(token, stopId)}/arrive`, payload),
  leave: (token: string, stopId: number) => post(`${stopPath(token, stopId)}/leave`),
  stopNotDone: (token: string, stopId: number, payload: PublicNotDonePayload) =>
    post(`${stopPath(token, stopId)}/not-done`, payload),

  /** Work visit: the issue → work done. Inspection visit: findings + estimate. */
  issueDone: (token: string, stopId: number, ticketIssueId: number, payload: PublicIssueDonePayload) =>
    post(`${stopIssuePath(token, stopId, ticketIssueId)}/done`, payload),
  issueNotDone: (token: string, stopId: number, ticketIssueId: number, payload: PublicNotDonePayload) =>
    post(`${stopIssuePath(token, stopId, ticketIssueId)}/not-done`, payload),

  /** "I bought something". supplierName creates the supplier when new. */
  addPurchase: (token: string, payload: PublicPurchasePayload) => post(`${root(token)}/purchases`, payload),
  /** Always visible to the office (never private). */
  addNote: (token: string, payload: PublicNotePayload) => post(`${root(token)}/notes`, payload),

  /** Name lookups for the purchase form. */
  searchSuppliers(token: string, search: string, signal?: AbortSignal): Promise<IdName[]> {
    return http.rows<IdName>(`${root(token)}/suppliers`, { ...PUBLIC, query: { search }, signal });
  },
  searchParts(token: string, search: string, signal?: AbortSignal): Promise<IdName[]> {
    return http.rows<IdName>(`${root(token)}/parts`, { ...PUBLIC, query: { search }, signal });
  },
};
