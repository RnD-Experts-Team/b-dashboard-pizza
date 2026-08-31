import { NextRequest } from "next/server";
import { proxyScheduling } from "../_lib/proxy";

/**
 * Smoke test for the whole auth chain: pizzasys token verify, the service
 * client, and the upstream auth rules. A 200 here means the wiring is sound —
 * run it before debugging anything else.
 */
export async function GET(request: NextRequest) {
  return proxyScheduling(request, "/health", { method: "GET" });
}
