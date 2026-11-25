import { NextRequest } from "next/server";
import { proxyToolbox } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

/**
 * Create an event or a reminder (FRONTEND_CALENDAR_GUIDE §8.1). The body goes through untouched.
 * A task is NOT created here any more (422): it goes to `../tasks/route.ts` (FRONTEND_UPDATE_2026-11-24).
 */
export async function POST(request: NextRequest) {
  return proxyToolbox(request, "/calendar/events", { method: "POST", forwardBody: true });
}
