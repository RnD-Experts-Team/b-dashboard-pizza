import { areaHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** Payments: list/create, one payment, edit, mistaken, notes, attachments. MAINTENANCE §4. */
const area = areaHandlers("payments");

export const GET = area.GET;
export const POST = area.POST;
export const PATCH = area.PATCH;
export const PUT = area.PUT;
export const DELETE = area.DELETE;
