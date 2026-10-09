import { NextRequest } from "next/server";
import {
  toolboxGet,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

/** Cross-store inbox — filtered upstream to what the caller can see. */
export async function GET(request: NextRequest) {
  return toolboxGet(request, "/tickets");
}
