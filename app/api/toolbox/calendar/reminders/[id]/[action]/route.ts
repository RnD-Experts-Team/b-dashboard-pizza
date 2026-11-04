import { NextRequest } from "next/server";
import { errorResponse } from "@/app/api/_lib/auth";
import { proxyToolbox, seg } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

/** Snooze, mark done or cancel a reminder (FRONTEND_CALENDAR_GUIDE §8.4). */
const ACTIONS = new Set(["snooze", "done", "cancel"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  if (!ACTIONS.has(action)) return errorResponse("INVALID_REQUEST", "Unknown reminder action.", 404);
  return proxyToolbox(request, `/calendar/reminders/${seg(id)}/${action}`, { method: "POST", forwardBody: true });
}
