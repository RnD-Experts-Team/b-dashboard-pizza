import { NextRequest } from "next/server";
import { proxyToolbox } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

/**
 * Create a task (FRONTEND_UPDATE_2026-11-24): tasks have their own route so pizzasys can
 * require a permission for them alone (the `Calendar Tasks` role). Same body and answer
 * as an event, minus `type`. A task sent to `events/` is refused with 422. The body goes
 * through untouched. Task steps live under `tasks/[id]/[action]`.
 */
export async function POST(request: NextRequest) {
  return proxyToolbox(request, "/calendar/tasks", { method: "POST", forwardBody: true });
}
