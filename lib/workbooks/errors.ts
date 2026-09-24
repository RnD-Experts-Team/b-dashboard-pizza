import { WorkbooksError } from "@/lib/api/services/workbooks.service";
import type { WorkbooksErrorState } from "@/types/workbooks.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Workbook error reading — pure, no React.                                 */
/*                                                                            */
/*  Components turn a `kind` into translated copy; this file only decides    */
/*  WHICH situation we are in, from the server's own codes.                  */
/* ────────────────────────────────────────────────────────────────────────── */

export function isCancelled(err: unknown): boolean {
  return err instanceof WorkbooksError && err.code === "CANCELLED";
}

export function toErrorState(err: unknown): WorkbooksErrorState {
  if (err instanceof WorkbooksError) {
    return {
      message: err.message,
      code: err.code,
      serverCode: err.serverCode,
      retryable: err.retryable,
      cappedBy: err.cappedBy,
    };
  }
  return {
    message: "An unexpected error occurred.",
    code: "UNKNOWN",
    serverCode: null,
    retryable: false,
    cappedBy: null,
  };
}

/**
 * The situations the UI explains differently.
 *
 * - `notFound`: a 404 means "you may not see it" as much as "it is gone". The
 *   API answers every forbidden READ with 404 on purpose, so the UI must never
 *   say "deleted".
 * - `noAccess`: a 403. On a list or catalogue call that usually means the
 *   pizzasys auth rules for the toolbox aren't seeded yet.
 */
export type WorkbookErrorKind =
  | "notFound"
  | "noAccess"
  | "storeUnknown"
  | "noStore"
  | "auth"
  | "network"
  | "timeout"
  | "server"
  | "generic";

export function errorKind(state: Pick<WorkbooksErrorState, "code" | "serverCode">): WorkbookErrorKind {
  if (state.serverCode === "STORE_NOT_FOUND") return "storeUnknown";
  switch (state.code) {
    case "NOT_FOUND":
      return "notFound";
    case "FORBIDDEN":
      return "noAccess";
    case "NO_STORE":
      return "noStore";
    case "NOT_AUTHENTICATED":
      return "auth";
    case "NETWORK_ERROR":
      return "network";
    case "TIMEOUT":
      return "timeout";
    case "SERVER_ERROR":
      return "server";
    default:
      return "generic";
  }
}

/** Flatten the Laravel 422 bag to { field: firstMessage }. */
export function getWorkbookFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof WorkbooksError) || !err.validationErrors) return {};
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(err.validationErrors)) {
    if (Array.isArray(messages) && messages[0]) out[key] = messages[0];
  }
  return out;
}

/** The 409 on deleting a non-empty folder carries the counts for the dialog. */
export function readFolderNotEmpty(
  err: unknown,
): { childFolders: number; workbooks: number } | null {
  if (!(err instanceof WorkbooksError) || err.serverCode !== "WORKBOOK_FOLDER_NOT_EMPTY") return null;
  return {
    childFolders: Number(err.details.child_folders ?? 0),
    workbooks: Number(err.details.workbooks ?? 0),
  };
}

/** WORKBOOK_CELL_TYPE_MISMATCH: which column, and for a select the allowed values. */
export function readCellMismatch(
  err: unknown,
): { columnId: number | null; allowed: string[] | null; message: string } | null {
  if (!(err instanceof WorkbooksError) || err.serverCode !== "WORKBOOK_CELL_TYPE_MISMATCH") return null;
  const allowed = Array.isArray(err.details.allowed) ? (err.details.allowed as unknown[]).map(String) : null;
  const columnId = err.details.column_id != null ? Number(err.details.column_id) : null;
  return { columnId, allowed, message: err.message };
}

export function hasServerCode(err: unknown, code: string): boolean {
  return err instanceof WorkbooksError && err.serverCode === code;
}

/** The server's message, or a fallback — for toasts. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof WorkbooksError && err.message) return err.message;
  return fallback;
}
