import { areaHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** Technician purchases (things a technician bought and is owed for). MAINTENANCE-V2 §4. */
const area = areaHandlers("technician-purchases");

export const GET = area.GET;
export const POST = area.POST;
export const PATCH = area.PATCH;
export const PUT = area.PUT;
export const DELETE = area.DELETE;
