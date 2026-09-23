import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyGet } from "@/app/api/daily-pay-entries/_lib/proxy";

/** Full detail of one entry: payments, lines, notes, attachments, revisions. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entry: string }> }
) {
  const { entry } = await params;
  if (!entry) return errorJson("MISSING_PARAM", "entry is required", 400);
  return proxyGet(request, `${BASE_URL}/daily-pay-entries/${encodeURIComponent(entry)}`);
}
