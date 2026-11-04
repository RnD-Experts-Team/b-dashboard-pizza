import axios from "axios";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Report Builder errors — one reader for every failure the UI shows.        */
/*                                                                            */
/*  The BFF answers failures with the app-wide envelope from                  */
/*  app/api/_lib/auth.ts: `{ success:false, error:{ code, message, details }}`*/
/*  where a 422 carries Data's field errors in `details.errors`               */
/*  (`{"columns.2.expr": ["Unknown column \"c9\""]}`).                        */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ReportError {
  status: number | null;
  code: string;
  message: string;
  fieldErrors: Record<string, string[]>;
  retryAfter: number | null;
}

interface Envelope {
  error?: { code?: string; message?: string; details?: { errors?: unknown }; retryAfter?: unknown };
  message?: string;
  errors?: unknown;
}

function readFieldErrors(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([k, v]) => [
      k,
      (Array.isArray(v) ? v : [v]).map(String),
    ]),
  );
}

export function isCancelled(err: unknown): boolean {
  return axios.isCancel(err) || (err instanceof DOMException && err.name === "AbortError");
}

function isReportError(err: unknown): err is ReportError {
  return Boolean(err && typeof err === "object" && "fieldErrors" in err && "code" in err && "status" in err);
}

/** Reads any failure (axios error, Error, an already-read ReportError) into one shape. */
export function readReportError(err: unknown): ReportError {
  if (isReportError(err)) return err;
  if (axios.isAxiosError(err)) {
    const body = (err.response?.data ?? {}) as Envelope;
    const retry = Number(body.error?.retryAfter ?? err.response?.headers?.["retry-after"]);
    return {
      status: err.response?.status ?? null,
      code: body.error?.code ?? (err.response ? "UPSTREAM_ERROR" : "NETWORK_ERROR"),
      message: body.error?.message ?? body.message ?? err.message,
      fieldErrors: readFieldErrors(body.error?.details?.errors ?? body.errors),
      retryAfter: Number.isFinite(retry) ? retry : null,
    };
  }
  return {
    status: null,
    code: "INTERNAL_ERROR",
    message: err instanceof Error ? err.message : String(err),
    fieldErrors: {},
    retryAfter: null,
  };
}

/** The first field message, for a one-line toast under the general message. */
export function firstFieldError(e: ReportError): string | null {
  return Object.values(e.fieldErrors).flat()[0] ?? null;
}
