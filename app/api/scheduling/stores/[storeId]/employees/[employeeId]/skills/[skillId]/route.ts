import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../../../_lib/proxy";

type Params = { params: Promise<{ storeId: string; employeeId: string; skillId: string }> };

async function path({ params }: Params): Promise<string> {
  const { storeId, employeeId, skillId } = await params;
  return `/stores/${encodeURIComponent(storeId)}/employees/${encodeURIComponent(employeeId)}/skills/${encodeURIComponent(skillId)}`;
}

export async function POST(request: NextRequest, context: Params) {
  return proxyScheduling(request, await path(context), { method: "POST", forwardBody: true });
}

export async function DELETE(request: NextRequest, context: Params) {
  return proxyScheduling(request, await path(context), { method: "DELETE" });
}
