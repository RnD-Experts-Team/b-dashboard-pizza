import { areaHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** One serial-tracked part unit: PATCH part-units/{unit}. MAINTENANCE-V2 §1. */
const area = areaHandlers("part-units");

export const GET = area.GET;
export const POST = area.POST;
export const PATCH = area.PATCH;
export const PUT = area.PUT;
export const DELETE = area.DELETE;
