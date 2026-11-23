import type {
  Announcement,
  AnnouncementComment,
  AnnouncementMediaType,
  CommentMediaType,
  GifResult,
  ImageUploadResult,
  LikeResult,
  PageResult,
  VideoChunkResult,
  VideoInitResult,
} from "@/types/announcement.types";

/**
 * Reading the backend's answers defensively.
 *
 * The contract says what each endpoint returns; these helpers make the
 * services tolerant of the harmless variations Laravel produces (a bare array
 * vs `{ data: [...] }`, a resource wrapped in `{ data: {...} }`, ids as numeric
 * strings, an omitted nullable field) so the stores and UI can rely on the
 * types in `types/announcement.types.ts`.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  return fallback;
}

const MEDIA_TYPES: readonly string[] = ["image", "gif", "video"];

function mediaType(value: unknown): AnnouncementMediaType | null {
  return typeof value === "string" && MEDIA_TYPES.includes(value)
    ? (value as AnnouncementMediaType)
    : null;
}

function commentMediaType(value: unknown): CommentMediaType | null {
  return value === "image" || value === "gif" ? value : null;
}

/** `{ data: X }` -> X, otherwise the value itself. */
export function unwrapResource(value: unknown): unknown {
  const r = asRecord(value);
  return r && "data" in r && asRecord(r.data) ? r.data : value;
}

/** A bare array, `{ data: [...] }`, or null for neither. */
export function unwrapList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  const r = asRecord(value);
  if (r && Array.isArray(r.data)) return r.data;
  return null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Announcements                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export function normalizeAnnouncement(raw: unknown): Announcement {
  const r = asRecord(unwrapResource(raw)) ?? {};
  const a: Announcement = {
    id: num(r.id) ?? 0,
    type: str(r.type) || "general",
    title: str(r.title) ?? "",
    body: str(r.body) ?? "",
    version: str(r.version),
    is_active: bool(r.is_active, true),
    is_pinned: bool(r.is_pinned),
    starts_at: str(r.starts_at),
    ends_at: str(r.ends_at),
    media_url: str(r.media_url),
    media_type: mediaType(r.media_type),
    media_width: num(r.media_width),
    media_height: num(r.media_height),
    media_duration_seconds: num(r.media_duration_seconds),
    color_start: str(r.color_start),
    color_end: str(r.color_end),
    created_at: str(r.created_at) ?? "",
    updated_at: str(r.updated_at) ?? "",
  };

  // Optional fields stay absent when the endpoint didn't send them, so "not
  // included" can be told apart from zero / false.
  const likes = num(r.likes_count);
  if (likes !== null) a.likes_count = likes;
  if (r.liked_by_me !== undefined) a.liked_by_me = bool(r.liked_by_me);
  if (r.seen !== undefined) a.seen = bool(r.seen);
  const comments = num(r.comments_count);
  if (comments !== null) a.comments_count = comments;

  // A media url without a type (or the reverse) is unusable.
  if (!a.media_url || !a.media_type) {
    a.media_url = null;
    a.media_type = null;
  }
  return a;
}

export function normalizeAnnouncementList(raw: unknown): Announcement[] {
  return (unwrapList(raw) ?? []).map(normalizeAnnouncement);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Pages                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Laravel `{ data, links, meta }`, the older flat `{ current_page, data,
 * last_page, total, per_page }`, or a bare array (one page, no more).
 */
export function normalizePage<T>(
  raw: unknown,
  mapItem: (item: unknown) => T,
  requested: { page: number; perPage: number },
): PageResult<T> {
  const items = (unwrapList(raw) ?? []).map(mapItem);
  const r = asRecord(raw);
  const meta = asRecord(r?.meta) ?? r;

  const page = num(meta?.current_page) ?? requested.page;
  const perPage = num(meta?.per_page) ?? requested.perPage;
  const total = num(meta?.total) ?? items.length;
  const lastPage = Math.max(
    page,
    num(meta?.last_page) ?? (perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1),
  );
  return { items, page, lastPage, perPage, total };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Comments                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export function normalizeComment(raw: unknown): AnnouncementComment {
  const r = asRecord(unwrapResource(raw)) ?? {};
  const user = asRecord(r.user);
  const userId = user ? (num(user.id) ?? str(user.id)) : null;
  const authorId = num(r.user_id) ?? str(r.user_id) ?? userId ?? 0;

  const mediaUrl = str(r.media_url);
  const type = commentMediaType(r.media_type);

  return {
    id: num(r.id) ?? 0,
    announcement_id: num(r.announcement_id) ?? 0,
    user_id: authorId,
    body: str(r.body),
    media_url: mediaUrl && type ? mediaUrl : null,
    media_type: mediaUrl && type ? type : null,
    likes_count: num(r.likes_count) ?? 0,
    liked_by_me: bool(r.liked_by_me),
    user: user
      ? { id: userId ?? authorId, name: str(user.name) ?? "" }
      : null,
    created_at: str(r.created_at) ?? "",
    updated_at: str(r.updated_at) ?? "",
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Media                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export function normalizeGif(raw: unknown): GifResult | null {
  const r = asRecord(raw);
  if (!r) return null;
  const url = str(r.url);
  const preview = str(r.preview_url) ?? url;
  if (!url || !preview) return null;
  const id = r.id === undefined || r.id === null ? url : String(r.id);
  return {
    id,
    preview_url: preview,
    url,
    width: num(r.width) ?? 0,
    height: num(r.height) ?? 0,
  };
}

export function normalizeGifList(raw: unknown): GifResult[] {
  const out: GifResult[] = [];
  for (const item of unwrapList(raw) ?? []) {
    const gif = normalizeGif(item);
    if (gif) out.push(gif);
  }
  return out;
}

export function normalizeImageUpload(
  raw: unknown,
  fallbackType: "image" | "gif" = "image",
): ImageUploadResult {
  const r = asRecord(unwrapResource(raw)) ?? {};
  return {
    media_path: str(r.media_path) ?? "",
    media_url: str(r.media_url) ?? "",
    media_type: r.media_type === "gif" ? "gif" : r.media_type === "image" ? "image" : fallbackType,
  };
}

export function normalizeVideoInit(raw: unknown): VideoInitResult {
  const r = asRecord(unwrapResource(raw)) ?? {};
  return {
    upload_uuid: str(r.upload_uuid) ?? "",
    total_chunks: num(r.total_chunks) ?? 0,
  };
}

export function normalizeChunkResult(raw: unknown): VideoChunkResult {
  const r = asRecord(unwrapResource(raw)) ?? {};
  if (r.status === "complete" && str(r.media_path)) {
    return {
      status: "complete",
      media_path: str(r.media_path) ?? "",
      media_url: str(r.media_url) ?? "",
      media_type: "video",
      file_size: num(r.file_size) ?? 0,
      width: num(r.width),
      height: num(r.height),
      duration_seconds: num(r.duration_seconds),
    };
  }
  return {
    status: "pending",
    received: num(r.received) ?? 0,
    total: num(r.total) ?? 0,
  };
}

export function normalizeLike(raw: unknown): LikeResult {
  const r = asRecord(unwrapResource(raw)) ?? {};
  return {
    liked: bool(r.liked),
    likes_count: Math.max(0, num(r.likes_count) ?? 0),
  };
}
