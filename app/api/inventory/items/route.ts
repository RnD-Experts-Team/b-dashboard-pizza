import { NextRequest } from "next/server";
import { proxyInventory } from "../_lib/proxy";

export async function GET(request: NextRequest) {
  return proxyInventory(request, "/inventory/items", { method: "GET" });
}

export async function POST(request: NextRequest) {
  return proxyInventory(request, "/inventory/items", {
    method: "POST",
    forwardBody: true,
  });
}
