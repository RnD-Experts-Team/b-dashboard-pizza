import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ levelId: string }> };

/** { section_ids } — whole-list replace. */
export async function POST(request: NextRequest, { params }: Params) {
  const { levelId } = await params;
  const bad = checkSegments({ ids: [levelId] });
  if (bad) return bad;
  return toolboxPost(request, `/ticket-levels/${levelId}/sections`);
}
