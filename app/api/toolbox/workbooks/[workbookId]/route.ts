import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxDelete,
  toolboxGet,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ workbookId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { workbookId } = await params;
  const bad = checkSegments({ ids: [workbookId] });
  if (bad) return bad;
  return toolboxGet(request, `/workbooks/${workbookId}`);
}

/** Name / description / visibility only — columns have their own endpoint. */
export async function POST(request: NextRequest, { params }: Params) {
  const { workbookId } = await params;
  const bad = checkSegments({ ids: [workbookId] });
  if (bad) return bad;
  return toolboxPost(request, `/workbooks/${workbookId}`);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { workbookId } = await params;
  const bad = checkSegments({ ids: [workbookId] });
  if (bad) return bad;
  return toolboxDelete(request, `/workbooks/${workbookId}`);
}
