import { NextRequest } from "next/server";
import { UPSTREAM, proxyReportBuilder } from "../_lib/proxy";

/** GET /api/report-builder/schedules → the caller's schedules (a plain array or `{data:[…]}`). */
export async function GET(request: NextRequest) {
  return proxyReportBuilder(request, UPSTREAM.schedules(), { method: "GET" });
}

/**
 * POST /api/report-builder/schedules `{template_id, frequency, run_time, weekday, day_of_month,
 * timezone, recipients:{users}, format, delivery, is_active}`. A 503 here means pizzasys could
 * not mint the schedule's token; nothing was created.
 */
export async function POST(request: NextRequest) {
  return proxyReportBuilder(request, UPSTREAM.schedules(), { method: "POST", body: true, search: "" });
}
