import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/app/api/_lib/auth";
import { NOTIFICATIONS_BASE_URL } from "./proxy";

/**
 * What the Announcements routes check BEFORE a request is forwarded.
 *
 * The Notifications service validates everything again; this is the front door,
 * so a bad value never reaches it and never ends up shown to other users.
 */

const MEDIA_TYPES = new Set(["image", "gif", "video"]);

/** A path the Notifications service issued: `announcements/media/<uuid>.png`. */
const ISSUED_PATH = /^announcements\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** Giphy serves from media.giphy.com, i.giphy.com, media0.giphy.com … */
const GIPHY_HOST = /(^|\.)giphy\.com$/i;

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

const NOTIFICATIONS_HOST = hostOf(NOTIFICATIONS_BASE_URL);

/**
 * Where an announcement's or a comment's media may come from: a path the
 * Notifications service issued from one of its upload endpoints, or an https
 * address on Giphy (a picked GIF) or on the Notifications host itself.
 *
 * Anything else would make every reader's browser fetch a stranger's address.
 */
export function isAllowedMediaPath(value: string): boolean {
  if (value.length === 0 || value.length > 2048) return false;

  if (ISSUED_PATH.test(value)) {
    return !value.split("/").some((part) => part === ".." || part === ".");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  return (
    GIPHY_HOST.test(url.hostname) ||
    (NOTIFICATIONS_HOST !== null && url.host.toLowerCase() === NOTIFICATIONS_HOST)
  );
}

/**
 * For the create / update / comment bodies: `media_path` and `media_type`, when
 * present, must be allowed values. Returns a message to reject with, or null.
 */
export function validateMediaFields(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "The request body must be a JSON object";
  }
  const body = data as Record<string, unknown>;

  const path = body.media_path;
  if (path !== undefined && path !== null) {
    if (typeof path !== "string" || !isAllowedMediaPath(path)) {
      return "media_path is not an allowed media location";
    }
  }

  const type = body.media_type;
  if (type !== undefined && type !== null) {
    if (typeof type !== "string" || !MEDIA_TYPES.has(type)) {
      return "media_type must be image, gif or video";
    }
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Query strings                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

function badQuery(name: string): NextResponse {
  return errorResponse("INVALID_REQUEST", `Invalid ${name}`, 400);
}

/** `page` and `per_page` of the paged lists: whole numbers, when present. */
export function invalidPagingQuery(request: NextRequest): NextResponse | null {
  const params = request.nextUrl.searchParams;
  const page = params.get("page");
  if (page !== null && !/^\d{1,6}$/.test(page)) return badQuery("page");
  const perPage = params.get("per_page");
  if (perPage !== null && !/^\d{1,3}$/.test(perPage)) return badQuery("per_page");
  return null;
}

/** `q`, `limit` and `offset` of the GIF picker. */
export function invalidGifQuery(request: NextRequest): NextResponse | null {
  const params = request.nextUrl.searchParams;
  const limit = params.get("limit");
  if (limit !== null && !/^\d{1,3}$/.test(limit)) return badQuery("limit");
  const offset = params.get("offset");
  if (offset !== null && !/^\d{1,6}$/.test(offset)) return badQuery("offset");
  const q = params.get("q");
  if (q !== null && q.length > 100) return badQuery("q");
  return null;
}
