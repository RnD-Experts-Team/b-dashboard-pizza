import { NextRequest } from "next/server";
import { BASE_URL, proxyDelete } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ guide: string; attachment: string }> };

/** Remove one file from a troubleshooting guide. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { guide, attachment } = await params;
  return proxyDelete(
    request,
    `${BASE_URL}/troubleshooting-guides/${encodeURIComponent(guide)}/attachments/${encodeURIComponent(attachment)}`,
  );
}
