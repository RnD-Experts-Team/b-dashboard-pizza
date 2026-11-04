import { NextRequest } from "next/server";
import {
  BASE_URL,
  errorJson,
  hasUnsafeSegment,
  proxyPassthrough,
} from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = {
  params: Promise<{ store: string; ticket: string; issue: string; action: string[] }>;
};

/**
 * The issue workflow actions (MAINTENANCE §2 "Workflow actions"), all
 * POST under stores/{store}/tickets/{ticket}/issues/{issue}/…:
 *
 *   review · info-requests[/{r}/answer] · inspections[/{i}/result] ·
 *   approval-request · approvals · schedule · schedules/{a}/move ·
 *   work-done · confirmation · close · jump
 *
 * Only these first segments are forwarded; the older per-action folders next
 * to this one (notes, attachments, cancel, assigned-priority) keep their own
 * routes and take precedence over this catch-all.
 */
const ACTIONS = new Set([
  "review",
  "info-requests",
  "inspections",
  "approval-request",
  "approvals",
  "schedule",
  "schedules",
  "work-done",
  "confirmation",
  "close",
  "jump",
]);

export async function POST(request: NextRequest, { params }: Params) {
  const { store, ticket, issue, action } = await params;
  if (!store || !ticket || !issue || !action?.length) {
    return errorJson("MISSING_PARAM", "store, ticket, issue and action are required", 400);
  }
  if (!ACTIONS.has(action[0]) || hasUnsafeSegment(action)) {
    return errorJson("NOT_FOUND", "Unknown workflow action", 404);
  }
  const base = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/issues/${encodeURIComponent(issue)}`;
  return proxyPassthrough(request, `${base}/${action.map(encodeURIComponent).join("/")}`);
}
