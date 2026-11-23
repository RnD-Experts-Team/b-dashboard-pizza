/**
 * Announcement System Types (v2)
 *
 * Mirrors the Notifications service contract documented in
 * `docs/ANNOUNCEMENTS.md`. Read it before changing anything here.
 */

// ============================================================================
// Announcement
// ============================================================================

/** The types the UI knows how to style. The backend sends free text. */
export const KNOWN_ANNOUNCEMENT_TYPES = ["general", "maintenance", "urgent"] as const;
export type AnnouncementType = (typeof KNOWN_ANNOUNCEMENT_TYPES)[number];

export function isKnownAnnouncementType(value: unknown): value is AnnouncementType {
  return (
    typeof value === "string" &&
    (KNOWN_ANNOUNCEMENT_TYPES as readonly string[]).includes(value)
  );
}

/** A type the UI knows, or "general" for anything the backend invents. */
export function normalizeAnnouncementType(value: unknown): AnnouncementType {
  return isKnownAnnouncementType(value) ? value : "general";
}

export type AnnouncementMediaType = "image" | "gif" | "video";
/** Comments never carry video. */
export type CommentMediaType = "image" | "gif";

export interface Announcement {
  id: number;
  /** Free text on the wire. Use `normalizeAnnouncementType` before styling. */
  type: string;
  title: string;
  /** HTML. Only ever render it through `renderAnnouncementHtml`. */
  body: string;
  version: string | null;
  is_active: boolean;
  is_pinned: boolean;
  starts_at: string | null;
  ends_at: string | null;
  /** READ-ONLY. Safe as an <img>/<video> src. Never send it back. */
  media_url: string | null;
  media_type: AnnouncementMediaType | null;
  /** Video only, null otherwise. */
  media_width: number | null;
  media_height: number | null;
  media_duration_seconds: number | null;
  color_start: string | null;
  color_end: string | null;
  /** Present when the endpoint includes them. */
  likes_count?: number;
  liked_by_me?: boolean;
  /** Only on visible / unseen. */
  seen?: boolean;
  /** Forward-compatible: shown only if the backend ever adds it. */
  comments_count?: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Comments
// ============================================================================

export interface AnnouncementCommentUser {
  id: number | string;
  name: string;
}

export interface AnnouncementComment {
  id: number;
  announcement_id: number;
  user_id: number | string;
  /** A comment needs a body or media (or both). */
  body: string | null;
  media_url: string | null;
  media_type: CommentMediaType | null;
  likes_count: number;
  liked_by_me: boolean;
  user: AnnouncementCommentUser | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCommentPayload {
  body?: string;
  /** From an upload endpoint, or a picked GIF's absolute url. */
  media_path?: string;
  media_type?: CommentMediaType;
}

// ============================================================================
// Pagination
// ============================================================================

export interface LaravelPageLinks {
  first?: string | null;
  last?: string | null;
  prev?: string | null;
  next?: string | null;
}

export interface LaravelPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number | null;
  to?: number | null;
}

/** Laravel resource pagination: `{ data, links, meta }`. */
export interface LaravelPage<T> {
  data: T[];
  links?: LaravelPageLinks;
  meta?: LaravelPageMeta;
}

/** What the services hand to the stores, whichever shape the backend used. */
export interface PageResult<T> {
  items: T[];
  page: number;
  lastPage: number;
  perPage: number;
  total: number;
}

// ============================================================================
// Media
// ============================================================================

export interface GifResult {
  id: string;
  /** Small, for the picker grid. */
  preview_url: string;
  /** Full-size; this is what gets saved as `media_path`. */
  url: string;
  width: number;
  height: number;
}

export interface ImageUploadResult {
  media_path: string;
  media_url: string;
  media_type: "image" | "gif";
}

export interface VideoInitPayload {
  total_chunks: number;
  total_size: number;
  original_filename: string;
}

export interface VideoInitResult {
  upload_uuid: string;
  total_chunks: number;
}

/** Optional metadata sent with any ONE chunk; the server remembers it. */
export interface VideoChunkMeta {
  width?: number;
  height?: number;
  duration_seconds?: number;
}

export interface VideoChunkPending {
  status: "pending";
  received: number;
  total: number;
}

export interface VideoChunkComplete {
  status: "complete";
  media_path: string;
  media_url: string;
  media_type: "video";
  file_size: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
}

export type VideoChunkResult = VideoChunkPending | VideoChunkComplete;

// ============================================================================
// Likes
// ============================================================================

export interface LikeResult {
  liked: boolean;
  likes_count: number;
}

// ============================================================================
// Create / update payloads
// ============================================================================

/**
 * Every field is optional except `title` and `body` on create. Media is sent as
 * `media_path` (never `media_url`, which is read-only).
 *
 * `null` is how an update clears a nullable field. Whether the backend accepts
 * `media_path: null` / `color_start: null` is open question 3 in
 * `docs/ANNOUNCEMENTS.md`.
 */
export interface CreateAnnouncementPayload {
  type?: string;
  title: string;
  body: string;
  version?: string | null;
  is_active?: boolean;
  is_pinned?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  media_path?: string | null;
  media_type?: AnnouncementMediaType | null;
  media_width?: number | null;
  media_height?: number | null;
  media_duration_seconds?: number | null;
  color_start?: string | null;
  color_end?: string | null;
}

/** Partial update: send only the keys that changed. */
export type UpdateAnnouncementPayload = Partial<CreateAnnouncementPayload>;
