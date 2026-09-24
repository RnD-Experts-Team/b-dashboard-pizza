import { NextRequest } from "next/server";
import { checkSegments, toolboxPost } from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ storeId: string; workbookId: string }> };

/** Add a row. The row's store is the one in this path, which need not be the workbook's. */
export async function POST(request: NextRequest, { params }: Params) {
  const { storeId, workbookId } = await params;
  const bad = checkSegments({ store: storeId, ids: [workbookId] });
  if (bad) return bad;
  return toolboxPost(
    request,
    `/stores/${encodeURIComponent(storeId)}/workbooks/${workbookId}/rows`,
  );
}
