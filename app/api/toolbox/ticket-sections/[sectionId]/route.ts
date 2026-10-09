import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxDelete,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ sectionId: string }> };

/** Update — the key is immutable and ignored upstream. */
export async function POST(request: NextRequest, { params }: Params) {
  const { sectionId } = await params;
  const bad = checkSegments({ ids: [sectionId] });
  if (bad) return bad;
  return toolboxPost(request, `/ticket-sections/${sectionId}`);
}

/** Retires (deactivates), never deletes. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { sectionId } = await params;
  const bad = checkSegments({ ids: [sectionId] });
  if (bad) return bad;
  return toolboxDelete(request, `/ticket-sections/${sectionId}`);
}
