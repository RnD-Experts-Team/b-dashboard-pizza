import { fixedHandlers } from "@/app/api/maintenance-tickets/_lib/area-route";

/** Issue lookup for the pickers: a light row per issue across every store (search, store, statuses[], limit). MAINTENANCE-V2 §2. */
const area = fixedHandlers("ticket-issues");

export const GET = area.GET;
