import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxDelete,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ assignmentId: string }> };

/** Only store_scoped? / active? */
export async function POST(request: NextRequest, { params }: Params) {
  const { assignmentId } = await params;
  const bad = checkSegments({ ids: [assignmentId] });
  if (bad) return bad;
  return toolboxPost(request, `/ticket-assignments/${assignmentId}`);
}

/** A real delete — configuration, not history. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { assignmentId } = await params;
  const bad = checkSegments({ ids: [assignmentId] });
  if (bad) return bad;
  return toolboxDelete(request, `/ticket-assignments/${assignmentId}`);
}
