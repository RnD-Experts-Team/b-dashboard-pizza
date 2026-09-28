import { NextRequest } from "next/server";
import { checkSegments, toolboxPost } from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ storeId: string; folderId: string }> };

/** Create a workbook (with its columns) inside a folder. */
export async function POST(request: NextRequest, { params }: Params) {
  const { storeId, folderId } = await params;
  const bad = checkSegments({ store: storeId, ids: [folderId] });
  if (bad) return bad;
  return toolboxPost(
    request,
    `/stores/${encodeURIComponent(storeId)}/workbook-folders/${folderId}/workbooks`,
  );
}
