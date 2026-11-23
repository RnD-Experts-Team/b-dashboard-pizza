import { accentOf } from "@/lib/announcements/colors";
import { fieldError, type AnnouncementError } from "@/lib/announcements/errors";
import {
  localInputToIso,
  type AnnouncementFormState,
  type FormMedia,
} from "@/lib/announcements/payload";
import type { Announcement } from "@/types/announcement.types";
import type { MediaFieldValue } from "../editor/media-field";
import type { AnnouncementPostData } from "../feed/announcement-post";

/**
 * Pure helpers for the composer: which form field a backend field belongs to,
 * the first field with a problem, converting the media between the form's shape
 * and the media field's, and the draft the live preview draws.
 */

export const TITLE_MAX = 255;
export const VERSION_MAX = 50;

/** The places in the form an error can be shown, in the order they appear on screen. */
export type ComposerField =
  | "title"
  | "body"
  | "media"
  | "color"
  | "type"
  | "starts_at"
  | "ends_at"
  | "version";

export const FIELD_ORDER: readonly ComposerField[] = [
  "title",
  "body",
  "media",
  "color",
  "type",
  "starts_at",
  "ends_at",
  "version",
];

/** The backend's field names, mapped to the form field that shows them. */
export const SERVER_FIELD_TO_UI: Readonly<Record<string, ComposerField>> = {
  title: "title",
  body: "body",
  media_path: "media",
  media_type: "media",
  media_width: "media",
  media_height: "media",
  media_duration_seconds: "media",
  color_start: "color",
  color_end: "color",
  type: "type",
  starts_at: "starts_at",
  ends_at: "ends_at",
  version: "version",
};

/** The server field names behind each form field (what to read errors from). */
export const UI_TO_SERVER_FIELDS: Readonly<Record<ComposerField, readonly string[]>> = {
  title: ["title"],
  body: ["body"],
  media: ["media_path", "media_type", "media_width", "media_height", "media_duration_seconds"],
  color: ["color_start", "color_end"],
  type: ["type"],
  starts_at: ["starts_at"],
  ends_at: ["ends_at"],
  version: ["version"],
};

/** Which form fields an edit touches (a change clears the errors that were shown on them). */
export function fieldsTouchedBy(patch: Partial<AnnouncementFormState>): ComposerField[] {
  const touched: ComposerField[] = [];
  if ("title" in patch) touched.push("title");
  if ("body" in patch) touched.push("body");
  if ("media" in patch) touched.push("media");
  if ("colorStart" in patch || "colorEnd" in patch) touched.push("color");
  if ("type" in patch) touched.push("type");
  if ("startsAt" in patch) touched.push("starts_at");
  if ("endsAt" in patch) touched.push("ends_at");
  if ("version" in patch) touched.push("version");
  return touched;
}

/** The first form field (screen order) that a set of backend field names points at. */
export function firstErrorField(serverFields: Iterable<string>): ComposerField | null {
  const present = new Set<ComposerField>();
  for (const name of serverFields) {
    const ui = SERVER_FIELD_TO_UI[name];
    if (ui) present.add(ui);
  }
  return FIELD_ORDER.find((field) => present.has(field)) ?? null;
}

/** Backend fields the form has no place for (they are listed in the footer alert). */
export function unplacedFields(error: AnnouncementError | null): string[] {
  if (!error) return [];
  return Object.keys(error.fieldErrors).filter((name) => !(name in SERVER_FIELD_TO_UI));
}

/** The first message of a form field, from a server error. */
export function messageForField(
  error: AnnouncementError | null,
  field: ComposerField,
): string | null {
  return fieldError(error, ...UI_TO_SERVER_FIELDS[field]);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Media                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** The form's media as the media field wants it. `existing` has no path: the server never reveals it. */
export function formMediaToField(
  media: FormMedia | null,
  original: Announcement | null,
): MediaFieldValue | null {
  if (!media) return null;
  if (media.source === "existing") {
    return {
      media_path: "",
      media_type: media.type,
      media_url: media.url,
      media_width: original?.media_width ?? null,
      media_height: original?.media_height ?? null,
      media_duration_seconds: original?.media_duration_seconds ?? null,
    };
  }
  return {
    media_path: media.path,
    media_type: media.type,
    media_url: media.url,
    media_width: media.width ?? null,
    media_height: media.height ?? null,
    media_duration_seconds: media.durationSeconds ?? null,
  };
}

/** What the media field hands back (a finished upload or a picked GIF) as form media. */
export function fieldToFormMedia(value: MediaFieldValue): FormMedia {
  return {
    source: "new",
    path: value.media_path,
    url: value.media_url ?? value.media_path,
    type: value.media_type,
    width: value.media_width,
    height: value.media_height,
    durationSeconds: value.media_duration_seconds,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The live preview's draft                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface DraftLabels {
  /** Shown while the title is still empty. */
  untitled: string;
  /** Shown while the message is still empty. */
  emptyBody: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The form as the feed post draws it. Nothing here goes to the server: the id
 * is 0, the "seen" and like fields are absent, and the date the post was
 * created is `createdAt` (kept steady so the "5m ago" text does not flicker).
 */
export function buildDraftPost(
  form: AnnouncementFormState,
  original: Announcement | null,
  createdAt: string,
  labels: DraftLabels,
  bodyIsEmpty: boolean,
): AnnouncementPostData {
  const media = form.media;
  const existingVideo = media?.source === "existing" ? original : null;
  const accent = accentOf({
    color_start: form.colorStart || null,
    color_end: form.colorEnd || null,
  });

  return {
    id: 0,
    type: form.type || "general",
    title: form.title.trim() || labels.untitled,
    body: bodyIsEmpty ? `<p>${escapeHtml(labels.emptyBody)}</p>` : form.body,
    is_pinned: form.isPinned,
    starts_at: localInputToIso(form.startsAt),
    ends_at: localInputToIso(form.endsAt),
    media_url: media?.url ?? null,
    media_type: media?.type ?? null,
    media_width: media?.source === "new" ? (media.width ?? null) : (existingVideo?.media_width ?? null),
    media_height: media?.source === "new" ? (media.height ?? null) : (existingVideo?.media_height ?? null),
    media_duration_seconds:
      media?.source === "new"
        ? (media.durationSeconds ?? null)
        : (existingVideo?.media_duration_seconds ?? null),
    color_start: accent.start,
    color_end: accent.end,
    created_at: original?.created_at ?? createdAt,
    likes_count: original?.likes_count,
    liked_by_me: original?.liked_by_me,
  };
}
