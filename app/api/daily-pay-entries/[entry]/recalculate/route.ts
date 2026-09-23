import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPost } from "@/app/api/daily-pay-entries/_lib/proxy";

/**
 * Re-pull the frozen `gathered` figures (hours, reimbursable parts) from the
 * attendance records. Idempotent, and deliberately leaves lines with
 * hours_overridden: true untouched.
 *
 * proxyJsonPost calls request.json(), so the client must post `{}` — not an
 * empty body, which would 400 here before reaching upstream.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entry: string }> }
) {
  const { entry } = await params;
  if (!entry) return errorJson("MISSING_PARAM", "entry is required", 400);
  return proxyJsonPost(
    request,
    `${BASE_URL}/daily-pay-entries/${encodeURIComponent(entry)}/recalculate`
  );
}
