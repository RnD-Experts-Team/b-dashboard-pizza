import { areaHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** Trips (clocking): list/create, one trip, its link, stops, sessions, events, notes, attachments. MAINTENANCE-V2 §3. */
const area = areaHandlers("trips");

export const GET = area.GET;
export const POST = area.POST;
export const PATCH = area.PATCH;
export const PUT = area.PUT;
export const DELETE = area.DELETE;
