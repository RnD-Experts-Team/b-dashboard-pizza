import { NextRequest } from "next/server";
import { BASE_URL, errorJson, hasUnsafeSegment, proxyPassthrough } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ ticket: string; path: string[] }> };

const BAD_REQUEST = 400;
const NOT_FOUND = 404;

/**
 * One ticket, reached WITHOUT a store segment: tickets at one of our storage
 * locations, or at a place written in words, have no store to put in the URL.
 * Upstream registers the whole /stores/{store}/tickets/{ticket}/… group a
 * second time as /tickets/{ticket}/… (MOS only), and this route forwards to
 * it — the reads, every workflow step, notes and files.
 *
 * `GET issues` is also the one storeless read store tickets use (its
 * `?store_id=` scopes the auth rule), so the query string is forwarded.
 * Only the paths below go through ({id} = a number); anything else is a 404.
 */
const ISSUE_STEPS = [
  "cancel",
  "assigned-priority",
  "notes",
  "attachments",
  "review",
  "info-requests",
  "info-requests/{id}/answer",
  "inspections",
  "inspections/{id}/result",
  "approval-request",
  "approvals",
  "schedule",
  "schedules/{id}/move",
  "work-done",
  "confirmation",
  "close",
  "jump",
];

const ALLOWED: Record<string, string[]> = {
  GET: ["issues", "issues/{id}", "notes", "notes/all"],
  POST: [
    "restore",
    "cancel",
    "final-note",
    "notes",
    "attachments",
    ...ISSUE_STEPS.map((step) => `issues/{id}/${step}`),
    "assignments/{id}/notes",
    "assignments/{id}/attachments",
    "warranties/{id}/notes",
    "warranties/{id}/attachments",
  ],
  PATCH: ["issues/{id}", "notes/{id}/privacy"],
};

/**
 * A record id: digits only. Accepts "42", rejects "4a" and "".
 * https://regex101.com/?flavor=javascript&regex=%5E%5Cd%2B%24&testString=42%0A4a
 */
const RECORD_ID = /^\d+$/;

function matches(template: string, segments: string[]): boolean {
  const parts = template.split("/");
  return (
    parts.length === segments.length &&
    parts.every((part, i) => (part === "{id}" ? RECORD_ID.test(segments[i]) : part === segments[i]))
  );
}

async function forward(request: NextRequest, { params }: Params) {
  const { ticket, path } = await params;
  if (!ticket || !path?.length) return errorJson("MISSING_PARAM", "ticket and path are required", BAD_REQUEST);

  const allowed = ALLOWED[request.method.toUpperCase()] ?? [];
  if (hasUnsafeSegment(path) || !allowed.some((template) => matches(template, path))) {
    return errorJson("NOT_FOUND", "Unknown ticket route", NOT_FOUND);
  }

  const qs = new URL(request.url).searchParams.toString();
  const upstream = `${BASE_URL}/tickets/${encodeURIComponent(ticket)}/${path.map(encodeURIComponent).join("/")}`;
  return proxyPassthrough(request, qs ? `${upstream}?${qs}` : upstream);
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
