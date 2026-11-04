import { NextRequest, NextResponse } from "next/server";
import {
  authorizationOrError,
  BASE_URL,
  errorJson,
  fetchWithTimeout,
} from "@/app/api/maintenance-tickets/_lib/proxy";

/** The whole maintenance workbook as Excel; streamed back as a file, not JSON. */
export async function GET(request: NextRequest) {
  const auth = authorizationOrError(request);
  if ("error" in auth) return auth.error;

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/export/excel`, {
      method: "GET",
      headers: {
        Authorization: auth.authorization,
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json",
      },
    });

    if (!res.ok) {
      return errorJson("UPSTREAM_ERROR", "Export failed", res.status >= 500 ? 502 : res.status);
    }

    const blob = await res.arrayBuffer();
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type":
          res.headers.get("Content-Type") ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          res.headers.get("Content-Disposition") ||
          'attachment; filename="maintenancepizza-export.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Export timed out", 504);
    }
    return errorJson("NETWORK_ERROR", "Failed to reach maintenance service", 502);
  }
}
