import { fixedHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** Inspection lookup for the payment's Inspection line (technician_id, unpaid, search, limit). MAINTENANCE-V2 §4. */
const area = fixedHandlers("issue-inspections");

export const GET = area.GET;
