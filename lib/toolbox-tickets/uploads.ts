/* ────────────────────────────────────────────────────────────────────────── */
/*  Ticket upload rules — mirrors the backend. The server SNIFFS the MIME    */
/*  type from content, so these checks are a courtesy, not a guarantee: a    */
/*  renamed file still 422s on `files.N`, and the UI shows that per file.    */
/* ────────────────────────────────────────────────────────────────────────── */

export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Extension → accepted MIME types. html / svg are excluded on purpose (stored XSS). */
const ALLOWED: Record<string, string[]> = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  heic: ["image/heic", "image/heif"],
  pdf: ["application/pdf"],
  txt: ["text/plain"],
  csv: ["text/csv", "text/plain", "application/vnd.ms-excel"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  mp4: ["video/mp4"],
  mov: ["video/quicktime"],
};

export const ACCEPT_ATTR = Object.keys(ALLOWED)
  .map((e) => `.${e}`)
  .join(",");

/** Human list shown under every picker. */
export const ALLOWED_LABEL =
  "JPG, PNG, GIF, WEBP, HEIC, PDF, TXT, CSV, DOC, DOCX, XLS, XLSX, MP4, MOV";

export type FileProblem = "type" | "size";

export function fileProblem(file: File): FileProblem | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimes = ALLOWED[ext];
  if (!mimes) return "type";
  // Browsers often leave `type` empty (heic, csv on Windows) — only reject a KNOWN mismatch.
  if (file.type && file.type !== "application/octet-stream" && !mimes.includes(file.type)) {
    return "type";
  }
  if (file.size > MAX_FILE_BYTES) return "size";
  return null;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Previewable in a plain <img>. HEIC isn't, in most browsers. */
export function isImage(mime: string | null | undefined): boolean {
  return Boolean(mime && mime.startsWith("image/") && mime !== "image/heic" && mime !== "image/heif");
}
