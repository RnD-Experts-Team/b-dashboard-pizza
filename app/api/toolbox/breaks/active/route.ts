import { NextRequest } from "next/server";
import { proxyToolbox } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

// NOTE: this read WRITES upstream (milestone evaluation). Never cache it.
export async function GET(request: NextRequest) {
  return proxyToolbox(request, "/breaks/active", { method: "GET" });
}
