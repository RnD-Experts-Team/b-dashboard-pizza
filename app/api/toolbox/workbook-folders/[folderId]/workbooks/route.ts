import { NextRequest } from "next/server";
import { checkSegments, toolboxGet } from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ folderId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { folderId } = await params;
  const bad = checkSegments({ ids: [folderId] });
  if (bad) return bad;
  return toolboxGet(request, `/workbook-folders/${folderId}/workbooks`);
}
