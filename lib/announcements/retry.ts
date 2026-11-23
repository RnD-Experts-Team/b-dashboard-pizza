import axios from "axios";
import { parseRetryAfter } from "./errors";

/**
 * Retry helpers for the announcement upload requests.
 *
 * Copied (not imported) from `lib/hooks/use-screen-project-media.ts` so the two
 * features can't break each other, with one important fix: the original treated
 * ANY axios error without a status as retryable, which includes the error a
 * user-triggered abort produces. After Cancel, the upload kept retrying chunks
 * for a minute. Here a fired user signal ends every retry loop at once.
 */

export const MAX_ATTEMPTS = 6;
export const RETRY_BASE_DELAY_MS = 1_000;
export const RETRY_MAX_DELAY_MS = 20_000;
/** A server asking us to wait longer than this gets the error instead. */
export const RETRY_AFTER_CAP_MS = 120_000;

const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;
const HTTP_SERVER_ERROR = 500;

/** A DOMException-shaped abort that works in every runtime we target. */
export function createAbortError(message = "The operation was aborted."): Error {
  if (typeof DOMException === "function") {
    return new DOMException(message, "AbortError");
  }
  const err = new Error(message);
  err.name = "AbortError";
  return err;
}

/**
 * Worth sending again: the network dropped, the request stalled or timed out,
 * the server was busy (429) or failed (5xx). Any other 4xx answer will not
 * change on a retry.
 *
 * Never once the user's own signal has fired, and never for an axios cancel
 * (the service reports its stall timer as ECONNABORTED, so a cancel here is
 * always a caller abort).
 */
function isCancel(err: unknown): boolean {
  return axios.isCancel(err) || (axios.isAxiosError(err) && err.code === "ERR_CANCELED");
}

export function isRetryable(err: unknown, userSignal?: AbortSignal | null): boolean {
  if (userSignal?.aborted) return false;
  if (!axios.isAxiosError(err)) return false;
  if (isCancel(err)) return false;
  const status = err.response?.status;
  if (status === undefined) return true;
  return (
    status === HTTP_REQUEST_TIMEOUT ||
    status === HTTP_TOO_MANY_REQUESTS ||
    status >= HTTP_SERVER_ERROR
  );
}

/**
 * For a request that must not be repeated after the server may have processed
 * it (the LAST video chunk: the server may already have assembled the file).
 * Only 429 / 503 say "I did not do this, come back after Retry-After".
 */
export function isRetryableBeforeProcessing(
  err: unknown,
  userSignal?: AbortSignal | null,
): boolean {
  if (userSignal?.aborted) return false;
  if (!axios.isAxiosError(err) || isCancel(err)) return false;
  const status = err.response?.status;
  return status === HTTP_TOO_MANY_REQUESTS || status === HTTP_SERVICE_UNAVAILABLE;
}

/** Retry-After in ms when the server sent one, else exponential backoff. */
export function retryDelay(err: unknown, attempt: number): number {
  if (axios.isAxiosError(err)) {
    const seconds = parseRetryAfter(err.response?.headers?.["retry-after"]);
    if (seconds !== null) return Math.min(seconds * 1_000, RETRY_AFTER_CAP_MS);
  }
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS);
}

/** Sleep that ends (by rejecting with an AbortError) as soon as `signal` fires. */
export function abortableSleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface WithRetryOptions {
  /** The user's abort signal: stops the loop and the waits between attempts. */
  signal?: AbortSignal | null;
  maxAttempts?: number;
  /** Defaults to `isRetryable`. */
  shouldRetry?: (err: unknown, userSignal?: AbortSignal | null) => boolean;
  /** Called before each wait, e.g. to show "Retrying in 4 s…". */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

export async function withRetry<T>(
  send: () => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T> {
  const {
    signal,
    maxAttempts = MAX_ATTEMPTS,
    shouldRetry = isRetryable,
    onRetry,
  } = options;

  for (let attempt = 1; ; attempt++) {
    try {
      return await send();
    } catch (err) {
      if (attempt >= maxAttempts || !shouldRetry(err, signal)) throw err;
      const delay = retryDelay(err, attempt);
      onRetry?.(err, attempt, delay);
      await abortableSleep(delay, signal);
    }
  }
}

/**
 * `AbortSignal.any` where it exists (Chrome 116, Safari 17.4, Firefox 124),
 * a listener-based fallback elsewhere. Falsy entries are ignored.
 */
export function anySignal(
  signals: Array<AbortSignal | null | undefined>,
): AbortSignal {
  const list = signals.filter((s): s is AbortSignal => !!s);
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    return AbortSignal.any(list);
  }

  const controller = new AbortController();
  const aborted = list.find((s) => s.aborted);
  if (aborted) {
    controller.abort(aborted.reason);
    return controller.signal;
  }
  const onAbort = (event: Event) => {
    controller.abort((event.target as AbortSignal).reason);
    for (const s of list) s.removeEventListener("abort", onAbort);
  };
  for (const s of list) s.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}
