import { fixedHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** Maintenance settings: approval levels, trip link idle hours. MAINTENANCE-V2 §2. */
const area = fixedHandlers("maintenance-settings");

export const GET = area.GET;
export const PUT = area.PUT;
