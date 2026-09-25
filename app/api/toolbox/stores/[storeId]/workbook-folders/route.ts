import { NextRequest } from "next/server";
import { checkSegments, toolboxPost } from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ storeId: string }> };

/** Create a folder. `storeId` is the store CODE ("03795-00001"), never the numeric id. */
export async function POST(request: NextRequest, { params }: Params) {
  const { storeId } = await params;
  const bad = checkSegments({ store: storeId });
  if (bad) return bad;
  return toolboxPost(request, `/stores/${encodeURIComponent(storeId)}/workbook-folders`);
}
