import { NextRequest } from "next/server";
import { proxyToolbox, seg } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

/** Cancel an event or task. Only its creator may (anyone else gets a 403 upstream). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToolbox(request, `/calendar/events/${seg(id)}/cancel`, { method: "POST", forwardBody: true });
}
