import { NextRequest } from "next/server";
import { checkSegments, toolboxPost } from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ workbookId: string; rowId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { workbookId, rowId } = await params;
  const bad = checkSegments({ ids: [workbookId, rowId] });
  if (bad) return bad;
  return toolboxPost(request, `/workbooks/${workbookId}/rows/${rowId}/visibility`);
}
