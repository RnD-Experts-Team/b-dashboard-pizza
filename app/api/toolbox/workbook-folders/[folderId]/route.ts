import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxDelete,
  toolboxGet,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ folderId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { folderId } = await params;
  const bad = checkSegments({ ids: [folderId] });
  if (bad) return bad;
  return toolboxGet(request, `/workbook-folders/${folderId}`);
}

/** Rename / move / retag — partial. */
export async function POST(request: NextRequest, { params }: Params) {
  const { folderId } = await params;
  const bad = checkSegments({ ids: [folderId] });
  if (bad) return bad;
  return toolboxPost(request, `/workbook-folders/${folderId}`);
}

/** Cascades to the subtree; a non-empty folder needs `?force=true` (forwarded). */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { folderId } = await params;
  const bad = checkSegments({ ids: [folderId] });
  if (bad) return bad;
  return toolboxDelete(request, `/workbook-folders/${folderId}`);
}
