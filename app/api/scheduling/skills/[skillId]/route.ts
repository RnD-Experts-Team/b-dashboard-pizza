import { NextRequest } from "next/server";
import { proxyScheduling } from "../../_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await params;
  return proxyScheduling(request, `/skills/${encodeURIComponent(skillId)}`, { method: "POST", forwardBody: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await params;
  return proxyScheduling(request, `/skills/${encodeURIComponent(skillId)}`, { method: "DELETE" });
}
