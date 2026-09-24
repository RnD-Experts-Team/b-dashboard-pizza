import { NextRequest } from "next/server";
import { toolboxGet } from "@/app/api/toolbox/_lib/toolbox-proxy";

/**
 * GET /workbook-folders — `parent_id` has three distinct states (omitted = the
 * whole tree flat, empty = roots, a number = children). The query string is
 * forwarded verbatim, so an empty `parent_id=` survives.
 */
export async function GET(request: NextRequest) {
  return toolboxGet(request, "/workbook-folders");
}
