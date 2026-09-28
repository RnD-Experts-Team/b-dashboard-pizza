import { NextRequest } from "next/server";
import { toolboxGet } from "@/app/api/toolbox/_lib/toolbox-proxy";

/** GET /workbook-options — the visibility tags + column types, with labels. */
export async function GET(request: NextRequest) {
  return toolboxGet(request, "/workbook-options");
}
