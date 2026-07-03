import { NextRequest } from "next/server";
import { proxyInventory } from "@/app/api/inventory/_lib/proxy";

// No-auth — the employee opening a count link is not logged into the dashboard.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  return proxyInventory(
    request,
    `/public/inventory/${encodeURIComponent(token)}/submit`,
    { method: "POST", auth: false, forwardBody: true }
  );
}
