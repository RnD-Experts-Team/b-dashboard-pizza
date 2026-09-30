import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxDelete,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ levelId: string }> };

/** Update a level. */
export async function POST(request: NextRequest, { params }: Params) {
  const { levelId } = await params;
  const bad = checkSegments({ ids: [levelId] });
  if (bad) return bad;
  return toolboxPost(request, `/ticket-levels/${levelId}`);
}

/** Deactivates — answers with { assignments_affected }, not 204. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { levelId } = await params;
  const bad = checkSegments({ ids: [levelId] });
  if (bad) return bad;
  return toolboxDelete(request, `/ticket-levels/${levelId}`);
}
