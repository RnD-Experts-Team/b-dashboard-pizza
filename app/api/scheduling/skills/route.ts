import { NextRequest } from "next/server";
import { proxyScheduling } from "../_lib/proxy";

export async function GET(request: NextRequest) {
  return proxyScheduling(request, "/skills", { method: "GET" });
}

export async function POST(request: NextRequest) {
  return proxyScheduling(request, "/skills", { method: "POST", forwardBody: true });
}
