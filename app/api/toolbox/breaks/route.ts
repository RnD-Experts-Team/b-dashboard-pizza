import { NextRequest } from "next/server";
import { proxyToolbox } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyToolbox(request, "/breaks", { method: "GET" });
}

export async function POST(request: NextRequest) {
  return proxyToolbox(request, "/breaks", { method: "POST", forwardBody: true });
}
