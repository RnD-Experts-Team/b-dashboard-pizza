import { NextRequest } from "next/server";
import { checkSegments, toolboxPost } from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ folderId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { folderId } = await params;
  const bad = checkSegments({ ids: [folderId] });
  if (bad) return bad;
  return toolboxPost(request, `/workbook-folders/${folderId}/visibility`);
}
