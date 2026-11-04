import { areaHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** Trip sessions not yet paid: GET trip-sessions/unpaid. MAINTENANCE §3. */
const area = areaHandlers("trip-sessions");

export const GET = area.GET;
export const POST = area.POST;
export const PATCH = area.PATCH;
export const PUT = area.PUT;
export const DELETE = area.DELETE;
