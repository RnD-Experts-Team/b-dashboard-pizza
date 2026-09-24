import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxDelete,
  toolboxGet,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ workbookId: string; rowId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { workbookId, rowId } = await params;
  const bad = checkSegments({ ids: [workbookId, rowId] });
  if (bad) return bad;
  return toolboxGet(request, `/workbooks/${workbookId}/rows/${rowId}`);
}

/** Partial: only the cells named are touched. */
export async function POST(request: NextRequest, { params }: Params) {
  const { workbookId, rowId } = await params;
  const bad = checkSegments({ ids: [workbookId, rowId] });
  if (bad) return bad;
  return toolboxPost(request, `/workbooks/${workbookId}/rows/${rowId}`);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { workbookId, rowId } = await params;
  const bad = checkSegments({ ids: [workbookId, rowId] });
  if (bad) return bad;
  return toolboxDelete(request, `/workbooks/${workbookId}/rows/${rowId}`);
}
