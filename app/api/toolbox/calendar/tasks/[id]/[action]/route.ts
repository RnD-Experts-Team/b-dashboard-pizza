import { NextRequest } from "next/server";
import { errorResponse } from "@/app/api/_lib/auth";
import { proxyToolbox, seg } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

/**
 * The task lifecycle (FRONTEND_CALENDAR_GUIDE §8.3), plus a private task's
 * done / reopen (§8.3.1). The allowlist keeps the path parameter from choosing
 * an upstream route.
 */
const ACTIONS = new Set(["start", "submit", "approve", "return", "done", "reopen"]);

/** `?stores=` carries the ONE store the task is worked in (none for done/reopen); the query is forwarded as-is. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  if (!ACTIONS.has(action)) return errorResponse("INVALID_REQUEST", "Unknown task action.", 404);
  return proxyToolbox(request, `/calendar/tasks/${seg(id)}/${action}`, { method: "POST", forwardBody: true });
}
