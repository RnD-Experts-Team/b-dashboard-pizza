import { NextRequest } from "next/server";
import { checkSegments, toolboxGet } from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ workbookId: string }> };

/** The grid: search / filter[{columnId}] / sort_column / sort_order / page / per_page. */
export async function GET(request: NextRequest, { params }: Params) {
  const { workbookId } = await params;
  const bad = checkSegments({ ids: [workbookId] });
  if (bad) return bad;
  return toolboxGet(request, `/workbooks/${workbookId}/rows`);
}
