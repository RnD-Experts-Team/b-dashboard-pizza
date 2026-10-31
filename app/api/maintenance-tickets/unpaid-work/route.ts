import { fixedHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** Unpaid work per technician: clocked sessions not paid + purchases not paid back. MAINTENANCE §4. */
const area = fixedHandlers("unpaid-work");

export const GET = area.GET;
