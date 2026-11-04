import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  fetchWithTimeout,
  getAuthorizationHeader,
  requireAuthorization,
} from "@/app/api/_lib/auth";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Report Builder BFF → LC_PIZZA_DATA `/report-builder/*`.                   */
/*                                                                            */
/*  The ONE place that knows the upstream paths: every route under            */
/*  app/api/report-builder/** calls `proxyReportBuilder(request, <path>)`     */
/*  with a path from `UPSTREAM` below, so a moved endpoint is a one-line      */
/*  change here. The caller's bearer is forwarded as is — Data checks it and  */
/*  the pizzasys auth rules decide. Failures come back in the app-wide error  */
/*  envelope from app/api/_lib/auth.ts; a 422 keeps Data's field `errors`.    */
/* ────────────────────────────────────────────────────────────────────────── */

export const DATA_API_URL =
  process.env.DATA_API_URL || process.env.NEXT_PUBLIC_DATA_API_URL || "https://data.lcportal.cloud/api";

export const JSON_TIMEOUT_MS = 30_000;
export const DOWNLOAD_TIMEOUT_MS = 120_000;

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_GONE = 410;
const HTTP_UNPROCESSABLE = 422;
const HTTP_TOO_MANY = 429;
const HTTP_BAD_GATEWAY = 502;
const HTTP_UNAVAILABLE = 503;
const HTTP_GATEWAY_TIMEOUT = 504;
const HTTP_NO_CONTENT = 204;
const MS_PER_SECOND = 1_000;

const ROOT = "/report-builder";
const seg = (v: string) => encodeURIComponent(v);

/** Upstream paths, relative to DATA_API_URL. */
export const UPSTREAM = {
  catalog: () => `${ROOT}/catalog`,
  preview: () => `${ROOT}/preview`,
  templates: () => `${ROOT}/templates`,
  template: (id: string) => `${ROOT}/templates/${seg(id)}`,
  run: () => `${ROOT}/run`,
  runs: () => `${ROOT}/runs`,
  runItem: (id: string) => `${ROOT}/runs/${seg(id)}`,
  runRows: (id: string) => `${ROOT}/runs/${seg(id)}/rows`,
  runDownload: (id: string) => `${ROOT}/runs/${seg(id)}/download`,
  schedules: () => `${ROOT}/schedules`,
  schedule: (id: string) => `${ROOT}/schedules/${seg(id)}`,
} as const;

// A template id or run ULID: "42", "01JBX4K9Q7ZB8R3M2N5P6T7V8W"; rejects "../x" and "a b".
// Tester: https://regex101.com/?flavor=javascript&regex=%5E%5BA-Za-z0-9_-%5D%7B1%2C64%7D%24&testString=01JBX4K9Q7ZB8R3M2N5P6T7V8W
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** A 400 for a malformed path id, or null when it is fine. */
export function invalidId(id: string | undefined, name: string): NextResponse | null {
  if (id && ID_RE.test(id)) return null;
  return errorResponse("INVALID_REQUEST", `Invalid ${name}.`, HTTP_BAD_REQUEST, { param: name });
}

interface ProxyOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Forward the request's JSON body. */
  body?: boolean;
  /** Query string to send; defaults to the incoming request's own. */
  search?: string;
  timeoutMs?: number;
  /** Pipe the upstream body through untouched (file downloads). */
  stream?: boolean;
}

interface UpstreamBody {
  message?: string;
  error?: { message?: string } | string;
  errors?: unknown;
}

async function readUpstreamBody(res: Response): Promise<UpstreamBody> {
  try {
    const parsed: unknown = await res.json();
    return parsed && typeof parsed === "object" ? (parsed as UpstreamBody) : {};
  } catch {
    return {};
  }
}

function messageOf(body: UpstreamBody, fallback: string): string {
  if (typeof body.error === "string") return body.error;
  return body.message || body.error?.message || fallback;
}

function busyResponse(code: "RATE_LIMITED" | "SERVICE_BUSY", message: string, status: number, retryAfter: string | null) {
  const res = errorResponse(code, message, status, retryAfter ? { retryAfter: Number(retryAfter) || retryAfter } : undefined);
  if (retryAfter) res.headers.set("Retry-After", retryAfter);
  return res;
}

/** Maps a failed Data response onto the app-wide error envelope. */
async function mapFailure(res: Response): Promise<NextResponse> {
  const body = await readUpstreamBody(res);
  const retryAfter = res.headers.get("Retry-After");
  const failures: Record<number, () => NextResponse> = {
    [HTTP_BAD_REQUEST]: () => errorResponse("INVALID_REQUEST", messageOf(body, "The request was not accepted."), HTTP_BAD_REQUEST),
    [HTTP_UNAUTHORIZED]: () => errorResponse("NOT_AUTHENTICATED", messageOf(body, "Your session has expired."), HTTP_UNAUTHORIZED),
    [HTTP_FORBIDDEN]: () => errorResponse("FORBIDDEN", messageOf(body, "You do not have access to this report."), HTTP_FORBIDDEN),
    [HTTP_NOT_FOUND]: () => errorResponse("NOT_FOUND", messageOf(body, "Not found."), HTTP_NOT_FOUND),
    [HTTP_GONE]: () => errorResponse("NOT_FOUND", messageOf(body, "This run has expired."), HTTP_GONE),
    [HTTP_CONFLICT]: () => errorResponse("VALIDATION_ERROR", messageOf(body, "Another run is still in progress."), HTTP_CONFLICT),
    [HTTP_UNPROCESSABLE]: () =>
      errorResponse("VALIDATION_ERROR", messageOf(body, ""), HTTP_UNPROCESSABLE, {
        errors: body.errors ?? {},
      }),
    [HTTP_TOO_MANY]: () => busyResponse("RATE_LIMITED", messageOf(body, "Too many requests. Please wait."), HTTP_TOO_MANY, retryAfter),
    [HTTP_UNAVAILABLE]: () => busyResponse("SERVICE_BUSY", "The Data service is busy. Please try again in a moment.", HTTP_UNAVAILABLE, retryAfter),
    [HTTP_GATEWAY_TIMEOUT]: () => errorResponse("TIMEOUT", messageOf(body, "The report took too long to answer."), HTTP_GATEWAY_TIMEOUT),
  };
  const known = failures[res.status];
  if (known) return known();
  return errorResponse(
    "UPSTREAM_ERROR",
    `The Data service returned an error (${res.status}).`,
    HTTP_BAD_GATEWAY,
    process.env.NODE_ENV === "development" ? { upstreamStatus: res.status, upstreamMessage: messageOf(body, "") } : undefined,
  );
}

const PASS_THROUGH_HEADERS = ["Content-Type", "Content-Disposition", "Content-Length"] as const;

function streamResponse(res: Response): NextResponse {
  const headers = new Headers({ "Cache-Control": "no-store" });
  // undici has already decoded a compressed body, so the upstream Content-Length
  // (the encoded size) no longer matches what is streamed on: leave it out.
  const decoded = Boolean(res.headers.get("Content-Encoding"));
  PASS_THROUGH_HEADERS.forEach((h) => {
    if (decoded && h === "Content-Length") return;
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  });
  return new NextResponse(res.body, { status: res.status, headers });
}

async function jsonResponse(res: Response): Promise<NextResponse> {
  if (res.status === HTTP_NO_CONTENT) return new NextResponse(null, { status: HTTP_NO_CONTENT, headers: { "Cache-Control": "no-store" } });
  const text = await res.text();
  return new NextResponse(text || "{}", {
    status: res.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function isAbort(err: unknown): boolean {
  return (err instanceof DOMException || err instanceof Error) && err.name === "AbortError";
}

/** Forwards one request to Data and maps the answer. */
export async function proxyReportBuilder(
  request: NextRequest,
  upstreamPath: string,
  { method, body = false, search, timeoutMs = JSON_TIMEOUT_MS, stream = false }: ProxyOptions,
): Promise<NextResponse> {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const headers: Record<string, string> = {
    Accept: stream ? "*/*" : "application/json",
    Authorization: getAuthorizationHeader(request) ?? "",
  };

  let payload: string | undefined;
  if (body) {
    try {
      payload = JSON.stringify(await request.json());
    } catch {
      return errorResponse("INVALID_REQUEST", "Invalid JSON body.", HTTP_BAD_REQUEST);
    }
    headers["Content-Type"] = "application/json";
  }

  const query = search ?? new URL(request.url).search;
  const url = `${DATA_API_URL}${upstreamPath}${query}`;
  // Reads follow the browser: a closed tab aborts them. Writes run to the end.
  const signal = method === "GET" ? request.signal : undefined;

  try {
    const res = await fetchWithTimeout(url, { method, headers, body: payload, cache: "no-store" }, timeoutMs, signal);
    if (!res.ok) return await mapFailure(res);
    return stream ? streamResponse(res) : await jsonResponse(res);
  } catch (err) {
    if (isAbort(err))
      return errorResponse("TIMEOUT", `The Data service did not answer within ${timeoutMs / MS_PER_SECOND}s.`, HTTP_GATEWAY_TIMEOUT);
    return errorResponse("NETWORK_ERROR", "Unable to reach the Data service.", HTTP_UNAVAILABLE);
  }
}
