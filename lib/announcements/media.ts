/**
 * Media rules and helpers for announcements (client side).
 *
 * The server is the authority on sizes and types (it answers 422 with its own
 * message); these checks exist only so an obviously wrong file is refused
 * before any bytes are sent.
 */

/* ────────────────────────────────────────────────────────────────────────── */
/*  Limits (from the contract)                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"] as const;
export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
/** Images and self-made GIFs: 10 MB max. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const VIDEO_EXTENSIONS = ["mp4", "mov", "webm"] as const;
export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

/** `accept` values for file inputs. */
export const IMAGE_ACCEPT = [
  ...IMAGE_EXTENSIONS.map((e) => `.${e}`),
  ...IMAGE_MIME_TYPES,
].join(",");
export const VIDEO_ACCEPT = [
  ...VIDEO_EXTENSIONS.map((e) => `.${e}`),
  ...VIDEO_MIME_TYPES,
].join(",");
export const MEDIA_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;

/**
 * Small chunks: on a store's slow line a 2 MB chunk still goes through well
 * inside the stall window, and a retry re-sends little. The image endpoint
 * already takes 10 MB bodies, so a 2 MB chunk is safe.
 */
export const VIDEO_CHUNK_SIZE = 2 * 1024 * 1024;
/** Chunk requests in flight at once (chunks 0…N-2; the last one goes alone). */
export const VIDEO_PARALLEL_CHUNKS = 3;
/** A video whose metadata never loads must not hold the upload back. */
export const VIDEO_METADATA_TIMEOUT_MS = 10_000;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Picking the kind of a file                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export type UploadKind = "image" | "gif" | "video";

export type MediaValidationCode =
  | "unsupportedType"
  | "imageTooLarge"
  | "emptyFile";

export interface MediaValidationError {
  code: MediaValidationCode;
  /** Short English sentence; the UI translates by `code`. */
  message: string;
  maxBytes?: number;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * Which upload a file would take, or null when it is neither an allowed image
 * nor an allowed video. Goes by MIME type first and falls back to the extension
 * (browsers leave `file.type` empty for some .mov files).
 */
export function classifyFile(file: Pick<File, "name" | "type">): UploadKind | null {
  const mime = file.type.toLowerCase();
  const ext = extensionOf(file.name);

  if (mime === "image/gif" || (!mime && ext === "gif")) return "gif";
  if (
    (IMAGE_MIME_TYPES as readonly string[]).includes(mime) ||
    (!mime && (IMAGE_EXTENSIONS as readonly string[]).includes(ext))
  ) {
    return "image";
  }
  if (
    (VIDEO_MIME_TYPES as readonly string[]).includes(mime) ||
    (!mime && (VIDEO_EXTENSIONS as readonly string[]).includes(ext))
  ) {
    return "video";
  }
  // A known extension with a surprising MIME type (some .mov files).
  if ((VIDEO_EXTENSIONS as readonly string[]).includes(ext) && mime.startsWith("video/")) {
    return "video";
  }
  return null;
}

/** null = fine. */
export function validateMediaFile(
  file: Pick<File, "name" | "type" | "size">,
): MediaValidationError | null {
  const kind = classifyFile(file);
  if (!kind) {
    return {
      code: "unsupportedType",
      message: "Use a JPG, PNG, WebP or GIF image, or an MP4, MOV or WebM video.",
    };
  }
  if (file.size <= 0) {
    return { code: "emptyFile", message: "That file is empty." };
  }
  if (kind !== "video" && file.size > IMAGE_MAX_BYTES) {
    return {
      code: "imageTooLarge",
      message: `Images and GIFs can be up to ${formatBytes(IMAGE_MAX_BYTES)}.`,
      maxBytes: IMAGE_MAX_BYTES,
    };
  }
  // The server's video limit is not documented (open question 4): its 422 on
  // init says so before a single chunk is sent.
  return null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Video metadata                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export interface VideoMetadata {
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export type VideoMetadataResult =
  | ({ ok: true } & VideoMetadata)
  | { ok: false; reason: "timeout" | "unreadable" | "unsupported" };

/**
 * Width, height and duration of a video file, read in the browser.
 *
 * A failure (an HEVC .mov in Chrome/Firefox, a webm with no duration, a slow
 * disk) is a WARNING for the caller, never a reason to refuse the upload: the
 * server just won't have the numbers.
 */
export function readVideoMetadata(
  file: Blob,
  timeoutMs: number = VIDEO_METADATA_TIMEOUT_MS,
): Promise<VideoMetadataResult> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || typeof URL === "undefined") {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const finish = (result: VideoMetadataResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const timer = setTimeout(() => finish({ ok: false, reason: "timeout" }), timeoutMs);

    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const width = video.videoWidth > 0 ? video.videoWidth : null;
      const height = video.videoHeight > 0 ? video.videoHeight : null;
      const duration = Number.isFinite(video.duration) && video.duration > 0
        ? Math.round(video.duration)
        : null;
      finish({ ok: true, width, height, durationSeconds: duration });
    };
    video.onerror = () => finish({ ok: false, reason: "unreadable" });
    video.src = url;
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Display helpers                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/** Only http(s) media may be put in a src. Returns null for anything else. */
export function safeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, "http://placeholder.invalid");
    // A relative URL resolves against the placeholder and is rejected: media
    // urls from the backend are absolute.
    if (parsed.origin === "http://placeholder.invalid") return null;
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** 1536 -> "1.5 KB". Binary units, one decimal from KB up. */
export function formatBytes(bytes: number, locale?: string): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const formatted =
    unit === 0
      ? String(Math.round(value))
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return `${formatted} ${units[unit]}`;
}

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return "";
  }
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
