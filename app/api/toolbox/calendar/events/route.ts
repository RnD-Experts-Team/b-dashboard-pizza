import { NextRequest } from "next/server";
import { proxyToolbox } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

/** Create an event, a task or a reminder (FRONTEND_CALENDAR_GUIDE §8.1). The body goes through untouched. */
export async function POST(request: NextRequest) {
  return proxyToolbox(request, "/calendar/events", { method: "POST", forwardBody: true });
}
