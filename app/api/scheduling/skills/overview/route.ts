import { NextRequest } from "next/server";
import { proxyScheduling } from "../../_lib/proxy";

/** `?storeIds[]=…` travels in the query string, which the proxy forwards as-is. */
export async function GET(request: NextRequest) {
  return proxyScheduling(request, "/skills/overview", { method: "GET" });
}
