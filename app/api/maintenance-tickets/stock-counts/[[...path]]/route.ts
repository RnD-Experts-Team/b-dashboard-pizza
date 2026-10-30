import { areaHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** Stock counts: list/start, the count sheet, save, apply, delete a draft. MAINTENANCE-V2 §5. */
const area = areaHandlers("stock-counts");

export const GET = area.GET;
export const POST = area.POST;
export const PATCH = area.PATCH;
export const PUT = area.PUT;
export const DELETE = area.DELETE;
