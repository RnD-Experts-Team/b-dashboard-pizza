/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance — trips, the office side (MAINTENANCE §3)              */
/*                                                                            */
/*  A trip is one technician's day: stops (stores + their issues), sessions  */
/*  (clock in → clock out) with break/driving/parts-run events, purchases,   */
/*  notes. The technician runs it from the public link (trip-portal.service); */
/*  the office creates, corrects (every correction needs a reason and is     */
/*  audited) and closes it here.                                              */
/*                                                                            */
/*  Internal routes: trips/[[...path]], trip-sessions/[...path].             */
/* ────────────────────────────────────────────────────────────────────────── */

import { http, request, seg } from "@/lib/api/maintenance-system/http";
import type {
  AddEventPayload,
  AddSessionPayload,
  CreateTripPayload,
  Page,
  ReasonPayload,
  Trip,
  TripFilters,
  TripLinkIssued,
  TripStopInput,
  TripWithLink,
  UnpaidSession,
  UpdateEventPayload,
  UpdateSessionPayload,
  UpdateTripPayload,
} from "@/types/maintenance-system";
import type { TicketAttachment, TicketNote } from "@/types/maintenance-tickets.types";

const tripPath = (tripId: number) => `/trips/${seg(tripId)}`;
const sessionPath = (tripId: number, sessionId: number) => `${tripPath(tripId)}/sessions/${seg(sessionId)}`;

type RawTripBody = { data?: Trip & { tripLink?: TripLinkIssued | null }; tripLink?: TripLinkIssued | null } | null;

/** `trip_link` may sit next to `data` or inside it. */
function toTripWithLink(body: RawTripBody): TripWithLink {
  const data = (body?.data ?? {}) as Trip & { tripLink?: TripLinkIssued | null };
  return { trip: data, tripLink: body?.tripLink ?? data.tripLink ?? null };
}

async function postForLink(path: string, payload: object = {}): Promise<TripWithLink> {
  return toTripWithLink(await request<RawTripBody>("POST", path, { body: payload }));
}

export const maintenanceTripsService = {
  listTrips(filters: TripFilters = {}, signal?: AbortSignal): Promise<Page<Trip>> {
    return http.page<Trip>("/trips", { query: filters, signal });
  },
  /** With audits. */
  getTrip(tripId: number, signal?: AbortSignal): Promise<Trip> {
    return http.get<Trip>(tripPath(tripId), { signal });
  },
  /** Returns the trip and its NEW link (show it once: Copy / Share). */
  createTrip(payload: CreateTripPayload): Promise<TripWithLink> {
    return postForLink("/trips", payload);
  },
  updateTrip(tripId: number, payload: UpdateTripPayload): Promise<Trip> {
    return http.patch<Trip>(tripPath(tripId), payload);
  },
  /** Rotates the link: the old one stops working. */
  issueNewLink(tripId: number): Promise<TripWithLink> {
    return postForLink(`${tripPath(tripId)}/link`);
  },
  closeTrip(tripId: number): Promise<Trip> {
    return http.post<Trip>(`${tripPath(tripId)}/close`);
  },
  reopenTrip(tripId: number): Promise<Trip> {
    return http.post<Trip>(`${tripPath(tripId)}/reopen`);
  },
  markTripMistaken(tripId: number, payload?: Partial<ReasonPayload>): Promise<Trip> {
    return http.post<Trip>(`${tripPath(tripId)}/mistaken`, payload);
  },

  /* ── Stops ──────────────────────────────────────────────────────────── */

  addStop(tripId: number, stop: TripStopInput): Promise<Trip> {
    return http.post<Trip>(`${tripPath(tripId)}/stops`, stop);
  },
  markStopMistaken(tripId: number, stopId: number, payload?: Partial<ReasonPayload>): Promise<Trip> {
    return http.post<Trip>(`${tripPath(tripId)}/stops/${seg(stopId)}/mistaken`, payload);
  },

  /* ── Sessions and events (every correction needs a reason) ───────────── */

  addSession(tripId: number, payload: AddSessionPayload): Promise<Trip> {
    return http.post<Trip>(`${tripPath(tripId)}/sessions`, payload);
  },
  updateSession(tripId: number, sessionId: number, payload: UpdateSessionPayload): Promise<Trip> {
    return http.patch<Trip>(sessionPath(tripId, sessionId), payload);
  },
  markSessionMistaken(tripId: number, sessionId: number, payload: ReasonPayload): Promise<Trip> {
    return http.post<Trip>(`${sessionPath(tripId, sessionId)}/mistaken`, payload);
  },
  addEvent(tripId: number, sessionId: number, payload: AddEventPayload): Promise<Trip> {
    return http.post<Trip>(`${sessionPath(tripId, sessionId)}/events`, payload);
  },
  updateEvent(tripId: number, sessionId: number, eventId: number, payload: UpdateEventPayload): Promise<Trip> {
    return http.patch<Trip>(`${sessionPath(tripId, sessionId)}/events/${seg(eventId)}`, payload);
  },
  markEventMistaken(tripId: number, sessionId: number, eventId: number, payload?: Partial<ReasonPayload>): Promise<Trip> {
    return http.post<Trip>(`${sessionPath(tripId, sessionId)}/events/${seg(eventId)}/mistaken`, payload);
  },

  /* ── Notes / files ──────────────────────────────────────────────────── */

  addNote(tripId: number, note: { body: string; isPrivate?: boolean; files?: File[] }): Promise<TicketNote> {
    return http.post<TicketNote>(`${tripPath(tripId)}/notes`, note);
  },
  addAttachments(tripId: number, files: File[]): Promise<TicketAttachment[]> {
    return http.post<TicketAttachment[]>(`${tripPath(tripId)}/attachments`, { files });
  },

  /* ── Unpaid sessions (the hourly payment line's picker) ──────────────── */

  listUnpaidSessions(technicianId?: number, signal?: AbortSignal): Promise<UnpaidSession[]> {
    return http.rows<UnpaidSession>("/trip-sessions/unpaid", { query: { technicianId }, signal });
  },
};
