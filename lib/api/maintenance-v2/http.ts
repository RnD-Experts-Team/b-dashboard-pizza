/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2 — the HTTP core every v2 service uses                     */
/*                                                                            */
/*  One place for: the auth token, the internal route base, snake ⇄ camel    */
/*  key mapping, JSON vs multipart encoding, and turning an axios failure    */
/*  into a MaintenanceTicketsError. The services stay one line per endpoint. */
/*                                                                            */
/*  Mapping is by KEY, generically (snake_case → camelCase on the way in,    */
/*  camelCase → snake_case on the way out) rather than one hand-written       */
/*  transform per type: the contract is large and still being built, and a   */
/*  generic mapper cannot forget a field. Values are left as the API sent    */
/*  them (money stays "12.50") except where the services normalise an enum. */
/*  Notes and attachments are run through the existing transforms so they   */
/*  are the same TicketNote / TicketAttachment the rest of the app renders. */
/* ────────────────────────────────────────────────────────────────────────── */

import axios, { type AxiosRequestConfig } from "axios";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { appendDeep, payloadHasFiles } from "@/lib/api/form-data";
import { BUSY_MESSAGE } from "@/lib/api/utils/error";
import { transformAttachment, transformNote } from "@/lib/api/services/maintenance-tickets.service";
import type { ApiTicketAttachment, ApiTicketNote } from "@/types/maintenance-tickets.types";

/** The dashboard's internal maintenance routes (app/api/maintenance-tickets/**). */
export const MAINTENANCE_API = "/api/maintenance-tickets";
/** The public trip routes (app/api/public/maintenance-trips/**). */
export const PUBLIC_TRIPS_API = "/api/public/maintenance-trips";

/** Plain reads and writes. */
export const DEFAULT_TIMEOUT_MS = 30_000;
/** Anything carrying photos/PDFs over a store's connection. */
export const UPLOAD_TIMEOUT_MS = 120_000;
/** Aggregations over up to 400 days. */
export const REPORT_TIMEOUT_MS = 60_000;

const HTTP_NO_CONTENT = 204;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_GONE = 410;
const HTTP_UNPROCESSABLE = 422;
const HTTP_TOO_MANY = 429;
const HTTP_SERVER = 500;
const HTTP_UNAVAILABLE = 503;

/* ── Token ───────────────────────────────────────────────────────────────── */

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function requireToken(): string {
  const token = readToken();
  if (!token) {
    throw new MaintenanceTicketsError("You must be logged in to perform this action.", "NOT_AUTHENTICATED");
  }
  return token;
}

/* ── Key mapping ─────────────────────────────────────────────────────────── */

/**
 * An underscore followed by a letter or digit, which becomes that character
 * upper-cased: "parts_run" → "partsRun", "line_2_id" → "line2Id"; "id" is unchanged.
 * https://regex101.com/?flavor=javascript&regex=_(%5Ba-z0-9%5D)&flags=g&testString=parts_run%0Aline_2_id%0Aid
 */
const SNAKE_BOUNDARY = /_([a-z0-9])/g;
/**
 * Each upper-case letter, which becomes "_" + its lower case:
 * "ticketIssueIds" → "ticket_issue_ids"; "id" is unchanged.
 * https://regex101.com/?flavor=javascript&regex=%5BA-Z%5D&flags=g&testString=ticketIssueIds%0Aid
 */
const CAMEL_BOUNDARY = /[A-Z]/g;

export function snakeToCamel(key: string): string {
  return key.replace(SNAKE_BOUNDARY, (_, c: string) => c.toUpperCase());
}

export function camelToSnake(key: string): string {
  return key.replace(CAMEL_BOUNDARY, (c) => `_${c.toLowerCase()}`);
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !isBlob(value);
}

/** Keys whose arrays hold attachments, mapped through transformAttachment. */
const ATTACHMENT_KEYS = new Set(["attachments", "receipts"]);
/** The key whose arrays hold notes, mapped through transformNote. */
const NOTES_KEY = "notes";

function looksLikeNote(value: unknown): boolean {
  return isPlainObject(value) && "body" in value && "id" in value;
}

function camelizeValue(key: string, raw: unknown): unknown {
  if (ATTACHMENT_KEYS.has(key) && Array.isArray(raw)) {
    return raw.filter(isPlainObject).map((a) => transformAttachment(a as unknown as ApiTicketAttachment));
  }
  if (key === NOTES_KEY && Array.isArray(raw) && raw.every(looksLikeNote)) {
    return raw.map((n) => transformNote(n as unknown as ApiTicketNote));
  }
  return camelizeKeys(raw);
}

/**
 * Deep snake_case → camelCase on keys. Arrays of attachments and notes go
 * through the app's existing transforms so they render with the existing
 * components (attachment-gallery, notes-list).
 */
export function camelizeKeys<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => camelizeKeys(v)) as T;
  if (!isPlainObject(value)) return value as T;

  return Object.fromEntries(
    Object.entries(value).map(([key, raw]) => [snakeToCamel(key), camelizeValue(key, raw)]),
  ) as T;
}

/**
 * Deep camelCase → snake_case on keys for a request body. `undefined` is
 * dropped (not sent); `null` is kept (it clears a field). Files pass through.
 */
export function snakeizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(snakeizeKeys);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, raw]) => raw !== undefined)
      .map(([key, raw]) => [camelToSnake(key), snakeizeKeys(raw)]),
  );
}

/* ── Query strings ───────────────────────────────────────────────────────── */

type QueryValue = string | number | boolean | null | undefined | Array<string | number>;

/**
 * camelCase params → `?snake_key=…`. Arrays repeat as `key[]`; `true` → `1`;
 * `false`, null, undefined and "" are left out (a filter that is off is not
 * sent, so the URL stays clean).
 */
export function toQuery(params?: Record<string, QueryValue> | object): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  Object.entries(params as Record<string, QueryValue>)
    .filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== false)
    .forEach(([key, value]) => {
      const snake = camelToSnake(key);
      if (Array.isArray(value)) value.forEach((v) => qs.append(`${snake}[]`, String(v)));
      else qs.set(snake, value === true ? "1" : String(value));
    });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/* ── Bodies ──────────────────────────────────────────────────────────────── */

/**
 * JSON unless a File is somewhere in the payload, then multipart with
 * bracket notation (`lines[0][part_id]`, `files[]`, `warranty[body]`).
 */
export function encodeBody(payload: object | undefined): { data: unknown; headers: Record<string, string> } {
  if (payload === undefined) return { data: undefined, headers: {} };
  const wire = snakeizeKeys(payload) as Record<string, unknown>;
  if (!payloadHasFiles(wire)) {
    return { data: wire, headers: { "Content-Type": "application/json" } };
  }
  const form = new FormData();
  Object.entries(wire).forEach(([key, value]) => appendDeep(form, key, value));
  // Let the browser set the multipart boundary.
  return { data: form, headers: {} };
}

/* ── Errors ──────────────────────────────────────────────────────────────── */

export function toMaintenanceError(err: unknown): MaintenanceTicketsError {
  if (err instanceof MaintenanceTicketsError) return err;
  if (axios.isCancel(err) || (axios.isAxiosError(err) && err.code === "ERR_CANCELED")) {
    return new MaintenanceTicketsError("Request cancelled.", "CANCELLED");
  }
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data as
      | { message?: string; error?: { message?: string }; errors?: Record<string, string[]>; context?: Record<string, unknown> }
      | undefined;
    const message = data?.message || data?.error?.message || err.message;

    if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
      return new MaintenanceTicketsError("Request timed out. Please try again.", "TIMEOUT");
    }
    if (status === HTTP_UNAUTHORIZED) return new MaintenanceTicketsError(message, "NOT_AUTHENTICATED");
    if (status === HTTP_FORBIDDEN) return new MaintenanceTicketsError(message, "FORBIDDEN");
    if (status === HTTP_NOT_FOUND) return new MaintenanceTicketsError(message, "NOT_FOUND");
    if (status === HTTP_GONE) return new MaintenanceTicketsError(message, "GONE");
    if (status === HTTP_UNPROCESSABLE) {
      return new MaintenanceTicketsError(message || "Validation failed.", "VALIDATION_ERROR", data?.errors, data?.context);
    }
    if (status === HTTP_CONFLICT) {
      return new MaintenanceTicketsError(
        message || "Someone else changed this at the same moment. Reload and try again.",
        "CONFLICT",
      );
    }
    if (status === HTTP_TOO_MANY) return new MaintenanceTicketsError("Too many requests. Wait a moment and try again.", "RATE_LIMITED");
    if (status != null && status >= HTTP_SERVER) {
      return new MaintenanceTicketsError(
        status === HTTP_UNAVAILABLE ? BUSY_MESSAGE : "Server error. Please try again.",
        "SERVER_ERROR",
      );
    }
    if (!err.response) return new MaintenanceTicketsError("Network error. Check your connection.", "NETWORK_ERROR");
  }
  return new MaintenanceTicketsError("An unexpected error occurred.", "UNKNOWN");
}

/* ── Requests ────────────────────────────────────────────────────────────── */

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestOptions {
  query?: object;
  body?: object;
  signal?: AbortSignal;
  timeout?: number;
  /** false = the public trip routes: no Authorization header. */
  auth?: boolean;
  /** Defaults to MAINTENANCE_API. */
  base?: string;
}

/**
 * Sends one request and returns the response body, camelCased. 204 → null.
 * Uploads get the long timeout automatically.
 */
export async function request<T = unknown>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
  const { data, headers } = encodeBody(opts.body);
  const isUpload = typeof FormData !== "undefined" && data instanceof FormData;
  const config: AxiosRequestConfig = {
    method,
    url: `${opts.base ?? MAINTENANCE_API}${path}${toQuery(opts.query)}`,
    data,
    signal: opts.signal,
    timeout: opts.timeout ?? (isUpload ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      ...headers,
      ...(opts.auth === false ? {} : { Authorization: `Bearer ${requireToken()}` }),
    },
  };
  try {
    const res = await axios.request(config);
    if (res.status === HTTP_NO_CONTENT || res.data === "" || res.data == null) return null as T;
    return camelizeKeys<T>(res.data);
  } catch (err) {
    throw toMaintenanceError(err);
  }
}

/** `{ data: X }` → X. Lists keep their envelope; use `page()` for those. */
export async function requestData<T>(method: HttpMethod, path: string, opts?: RequestOptions): Promise<T> {
  const body = await request<{ data: T } | null>(method, path, opts);
  return (body?.data ?? (body as unknown)) as T;
}

/**
 * A list: `{ data: [...], meta }` when paginated, or a bare `{ data: [...] }`.
 * A missing meta is filled in from the rows so callers never branch.
 */
export async function requestPage<T, M = import("@/types/maintenance-v2").PageMeta>(
  path: string,
  opts?: RequestOptions,
): Promise<{ data: T[]; meta: M }> {
  const body = await request<{ data?: T[]; meta?: M } | T[] | null>("GET", path, opts);
  const rows = Array.isArray(body) ? body : body?.data ?? [];
  const meta =
    (!Array.isArray(body) && body?.meta) ||
    ({ currentPage: 1, lastPage: 1, perPage: rows.length, total: rows.length, from: rows.length ? 1 : null, to: rows.length || null } as unknown as M);
  return { data: rows, meta };
}

/** A list read for its rows only (paginated or not). */
export async function requestRows<T>(path: string, opts?: RequestOptions): Promise<T[]> {
  const page = await requestPage<T>(path, opts);
  return page.data;
}

export const http = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "body">) => requestData<T>("GET", path, opts),
  post: <T>(path: string, body?: object, opts?: Omit<RequestOptions, "body">) =>
    requestData<T>("POST", path, { ...opts, body: body ?? {} }),
  patch: <T>(path: string, body: object, opts?: Omit<RequestOptions, "body">) =>
    requestData<T>("PATCH", path, { ...opts, body }),
  put: <T>(path: string, body: object, opts?: Omit<RequestOptions, "body">) =>
    requestData<T>("PUT", path, { ...opts, body }),
  delete: <T = null>(path: string, opts?: Omit<RequestOptions, "body">) => requestData<T>("DELETE", path, opts),
  page: requestPage,
  rows: requestRows,
  raw: request,
};

/** Encodes one path segment. */
export const seg = (value: string | number) => encodeURIComponent(String(value));
