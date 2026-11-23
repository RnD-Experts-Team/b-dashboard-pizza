import type {
  Announcement,
  AnnouncementMediaType,
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
} from "@/types/announcement.types";
import { normalizeHex, pairRule } from "./colors";

/**
 * Turning the composer's form state into API payloads.
 *
 *  - Create sends everything that matters.
 *  - Update sends ONLY the keys that changed (`buildUpdatePayload`).
 *  - Dates are `<input type="datetime-local">` strings in the user's own time
 *    zone; the API gets ISO instants, or null for "no start" / "no end".
 *    (v1 built its default with `toISOString().slice(0, 16)`, which is UTC
 *    shown in a LOCAL input, so every new announcement started hours off.)
 */

/* ────────────────────────────────────────────────────────────────────────── */
/*  Dates                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");

/** The value a datetime-local input wants, for an instant, in LOCAL time. */
export function toLocalInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** "Now" (plus an offset) as a datetime-local value, in local time. */
export function nowLocalInput(offsetMinutes = 0): string {
  return toLocalInputValue(new Date(Date.now() + offsetMinutes * 60_000));
}

/**
 * A datetime-local value (local time) to an ISO instant, or null when empty or
 * invalid. "YYYY-MM-DDTHH:mm" with no offset is parsed as LOCAL time.
 */
export function localInputToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Floor an instant to its minute, so a field the user didn't touch compares equal. */
function minuteOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor(t / 60_000);
}

/** ends_at must be on or after starts_at. Open-ended windows are always valid. */
export function isWindowValid(startsAt: string | null, endsAt: string | null): boolean {
  const s = minuteOf(startsAt);
  const e = minuteOf(endsAt);
  return s === null || e === null || e >= s;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Body                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * True when an editor body has no text: "", "<p></p>", "<p><br></p>",
 * "<p>&nbsp;</p>". Pure string work, so it runs anywhere.
 */
export function isBodyEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, "");
  if (text.length > 0) return false;
  // A horizontal rule alone is still content.
  return !/<hr[\s/>]/i.test(html);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Form state                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Media currently attached in the composer.
 *
 *  - `existing`: already on the announcement (edit mode). The server never
 *    reveals its `media_path`, so an unchanged attachment sends nothing.
 *  - `new`: just uploaded, or a picked GIF. `path` is what the API wants.
 */
export type FormMedia =
  | { source: "existing"; url: string; type: AnnouncementMediaType }
  | {
      source: "new";
      path: string;
      /** Preview URL: the upload's `media_url`, or the picked GIF's url. */
      url: string;
      type: AnnouncementMediaType;
      width?: number | null;
      height?: number | null;
      durationSeconds?: number | null;
    };

export interface AnnouncementFormState {
  type: string;
  title: string;
  /** HTML from the editor. */
  body: string;
  version: string;
  isActive: boolean;
  isPinned: boolean;
  /** datetime-local value, or "" = start now (null). */
  startsAt: string;
  /** datetime-local value, or "" = no end date (null). */
  endsAt: string;
  media: FormMedia | null;
  /** "" or a hex colour. */
  colorStart: string;
  /** "" or a hex colour. Meaningful only with a start colour. */
  colorEnd: string;
}

/** A blank form. A new announcement starts now and runs until it is switched off. */
export function emptyFormState(): AnnouncementFormState {
  return {
    type: "general",
    title: "",
    body: "",
    version: "",
    isActive: true,
    isPinned: false,
    startsAt: "",
    endsAt: "",
    media: null,
    colorStart: "",
    colorEnd: "",
  };
}

/** The form for editing an existing announcement. */
export function formStateFromAnnouncement(a: Announcement): AnnouncementFormState {
  return {
    type: a.type || "general",
    title: a.title,
    body: a.body,
    version: a.version ?? "",
    isActive: a.is_active,
    isPinned: a.is_pinned,
    startsAt: toLocalInputValue(a.starts_at),
    endsAt: toLocalInputValue(a.ends_at),
    media:
      a.media_url && a.media_type
        ? { source: "existing", url: a.media_url, type: a.media_type }
        : null,
    colorStart: normalizeHex(a.color_start) ?? "",
    colorEnd: normalizeHex(a.color_end) ?? "",
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Payloads                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/** The colours as they should be sent: end only ever travels with a start. */
function colorsOf(form: AnnouncementFormState): { start: string | null; end: string | null } {
  const start = normalizeHex(form.colorStart);
  const end = normalizeHex(form.colorEnd);
  if (pairRule(start, end) === "endNeedsStart") return { start: null, end: null };
  return { start, end: start ? end : null };
}

type MediaFields = Pick<
  CreateAnnouncementPayload,
  "media_path" | "media_type" | "media_width" | "media_height" | "media_duration_seconds"
>;

function newMediaFields(media: Extract<FormMedia, { source: "new" }>): MediaFields {
  const fields: MediaFields = {
    media_path: media.path,
    media_type: media.type,
  };
  // Dimensions and duration are for video only.
  if (media.type === "video") {
    if (media.width != null) fields.media_width = media.width;
    if (media.height != null) fields.media_height = media.height;
    if (media.durationSeconds != null) fields.media_duration_seconds = media.durationSeconds;
  }
  return fields;
}

export function buildCreatePayload(form: AnnouncementFormState): CreateAnnouncementPayload {
  const { start, end } = colorsOf(form);
  const version = form.version.trim();

  const payload: CreateAnnouncementPayload = {
    type: form.type || "general",
    title: form.title.trim(),
    body: form.body,
    is_active: form.isActive,
    is_pinned: form.isPinned,
    starts_at: localInputToIso(form.startsAt),
    ends_at: localInputToIso(form.endsAt),
  };
  if (version) payload.version = version;
  if (start) payload.color_start = start;
  if (end) payload.color_end = end;
  if (form.media?.source === "new") Object.assign(payload, newMediaFields(form.media));
  return payload;
}

/**
 * The keys that changed between `original` and `form`, and only those. An
 * empty object means there is nothing to save.
 *
 * Clearing media or a colour sends an explicit `null`. Whether the backend
 * accepts null there is open question 3 in docs/ANNOUNCEMENTS.md.
 */
export function buildUpdatePayload(
  original: Announcement,
  form: AnnouncementFormState,
): UpdateAnnouncementPayload {
  const payload: UpdateAnnouncementPayload = {};

  const title = form.title.trim();
  if (title !== original.title) payload.title = title;
  if (form.body !== original.body) payload.body = form.body;

  const type = form.type || "general";
  if (type !== (original.type || "general")) payload.type = type;

  const version = form.version.trim();
  if (version !== (original.version ?? "")) payload.version = version || null;

  if (form.isActive !== original.is_active) payload.is_active = form.isActive;
  if (form.isPinned !== original.is_pinned) payload.is_pinned = form.isPinned;

  const startsAt = localInputToIso(form.startsAt);
  if (minuteOf(startsAt) !== minuteOf(original.starts_at)) payload.starts_at = startsAt;
  const endsAt = localInputToIso(form.endsAt);
  if (minuteOf(endsAt) !== minuteOf(original.ends_at)) payload.ends_at = endsAt;

  const { start, end } = colorsOf(form);
  const originalStart = normalizeHex(original.color_start);
  const originalEnd = normalizeHex(original.color_end);
  if (start !== originalStart) payload.color_start = start;
  if (end !== originalEnd) payload.color_end = end;

  if (form.media === null) {
    if (original.media_url) {
      payload.media_path = null;
      payload.media_type = null;
    }
  } else if (form.media.source === "new") {
    Object.assign(payload, newMediaFields(form.media));
  }
  // form.media.source === "existing": untouched, send nothing.

  return payload;
}

export function isEmptyPayload(payload: object): boolean {
  return Object.keys(payload).length === 0;
}
