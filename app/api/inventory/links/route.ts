import { NextRequest } from "next/server";
import { proxyInventory } from "../_lib/proxy";

export async function POST(request: NextRequest) {
  return proxyInventory(request, "/inventory/links", {
    method: "POST",
    forwardBody: true,
  });
}
