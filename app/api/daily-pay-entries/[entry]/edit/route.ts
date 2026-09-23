import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyRawPost } from "@/app/api/daily-pay-entries/_lib/proxy";

/**
 * Replace the full content of an entry, snapshotting the prior state as a revision.
 * A stale edit (expected_updated_at mismatch) comes back as 409 — the raw
 * passthrough is what lets that status and body reach the service intact.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entry: string }> }
) {
  const { entry } = await params;
  if (!entry) return errorJson("MISSING_PARAM", "entry is required", 400);
  return proxyRawPost(request, `${BASE_URL}/daily-pay-entries/${encodeURIComponent(entry)}/edit`);
}
