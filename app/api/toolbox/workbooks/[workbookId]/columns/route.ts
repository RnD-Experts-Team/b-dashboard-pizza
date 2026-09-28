import { NextRequest } from "next/server";
import { checkSegments, toolboxGet, toolboxPost } from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ workbookId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { workbookId } = await params;
  const bad = checkSegments({ ids: [workbookId] });
  if (bad) return bad;
  return toolboxGet(request, `/workbooks/${workbookId}/columns`);
}

/** WHOLE-LIST replace. An omitted column is deleted along with its cells. */
export async function POST(request: NextRequest, { params }: Params) {
  const { workbookId } = await params;
  const bad = checkSegments({ ids: [workbookId] });
  if (bad) return bad;
  return toolboxPost(request, `/workbooks/${workbookId}/columns`);
}
