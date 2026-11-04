import { areaHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** Payment methods: the editable "How we paid" list — list/create, rename, delete. MAINTENANCE §4. */
const area = areaHandlers("payment-methods");

export const GET = area.GET;
export const POST = area.POST;
export const PATCH = area.PATCH;
export const DELETE = area.DELETE;
