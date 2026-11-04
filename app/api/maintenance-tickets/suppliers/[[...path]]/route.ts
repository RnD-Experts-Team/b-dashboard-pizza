import { areaHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** Suppliers: list/create, one supplier, edit, delete, restore, notes, attachments. MAINTENANCE §1. */
const area = areaHandlers("suppliers");

export const GET = area.GET;
export const POST = area.POST;
export const PATCH = area.PATCH;
export const PUT = area.PUT;
export const DELETE = area.DELETE;
