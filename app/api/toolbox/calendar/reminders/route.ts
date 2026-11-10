import { NextRequest } from "next/server";
import { proxyToolbox } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

/**
 * All of MY reminders, upcoming and already rung (FRONTEND_CALENDAR_GUIDE §8.4,
 * up to 200). The feed only carries the reminders that ring inside the visible
 * range, so this is how the Calendar knows an event has a reminder set for a day
 * it isn't showing.
 */
export async function GET(request: NextRequest) {
  return proxyToolbox(request, "/calendar/reminders", { method: "GET" });
}
