import { NextRequest } from "next/server";
import { BASE_URL, proxyDelete } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ step: string; attachment: string }> };

/** Remove one file from a troubleshooting step. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { step, attachment } = await params;
  return proxyDelete(
    request,
    `${BASE_URL}/troubleshooting-steps/${encodeURIComponent(step)}/attachments/${encodeURIComponent(attachment)}`,
  );
}
