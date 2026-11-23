"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnnouncementMediaType,
  VideoChunkComplete,
} from "@/types/announcement.types";
import { announcementMediaService } from "@/lib/api/services/announcement-media.service";
import {
  makeClientError,
  parseAnnouncementError,
  type AnnouncementError,
} from "@/lib/announcements/errors";
import {
  VIDEO_CHUNK_SIZE,
  VIDEO_PARALLEL_CHUNKS,
  classifyFile,
  readVideoMetadata,
  validateMediaFile,
  type MediaValidationCode,
  type VideoMetadataResult,
} from "@/lib/announcements/media";
import {
  anySignal,
  isRetryableBeforeProcessing,
  withRetry,
} from "@/lib/announcements/retry";

/**
 * One hook for every announcement upload: images and GIFs (one request) and
 * videos (chunked). The UI gets a small state machine:
 *
 *   idle -> validating -> uploading -> done | error      (+ cancelling)
 *
 * Video flow (see docs/ANNOUNCEMENTS.md section 1.3):
 *  1. Read width / height / duration in the browser. A failure only WARNS.
 *  2. Init. A 422 here means size or type; the server's message is shown
 *     before a single chunk is sent.
 *  3. Chunks 0..N-2 go through a pool of 3 workers (2 MB each), every one
 *     retried with `withRetry`.
 *  4. Then the LAST chunk goes alone, carrying width/height/duration. Only it
 *     can answer `complete`, so the server has the metadata when it assembles
 *     the file. It is retried only on 429 / 503 (the server hadn't started).
 *  5. An unknown-upload answer ("uploadExpired"):
 *       - on chunks 0..N-2: restart from init, ONCE;
 *       - on the last chunk: do NOT restart (the file may already be
 *         assembled). The UI shows "Upload again".
 *
 * Cancel aborts every request, waits for them to settle, then DELETEs the
 * upload. On unmount and on `pagehide` the DELETE is sent with `keepalive`.
 */

/** After the last byte of the last chunk the server assembles the file. */
const LAST_CHUNK_STALL_MS = 120_000;
const PROGRESS_EMIT_MS = 100;
const SPEED_WINDOW_MS = 3_000;

export type UploadState =
  | "idle"
  | "validating"
  | "uploading"
  | "cancelling"
  | "done"
  | "error";

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0..100. Held at 99 until the server has answered for the last chunk. */
  percent: number;
  /** Smoothed over the last few seconds, or null before there's enough data. */
  bytesPerSecond: number | null;
}

export interface UploadWarning {
  code: "videoMetadataUnavailable";
  reason: Extract<VideoMetadataResult, { ok: false }>["reason"];
  /** Short English sentence; the UI translates by `code`. */
  message: string;
}

export interface UploadResult {
  kind: AnnouncementMediaType;
  /** Send this as `media_path` when saving the announcement. */
  media_path: string;
  /** Show this as the preview. */
  media_url: string;
  media_type: AnnouncementMediaType;
  /** Video only. */
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  file_size: number;
  file_name: string;
}

export interface UseAnnouncementUploadResult {
  state: UploadState;
  progress: UploadProgress;
  result: UploadResult | null;
  error: AnnouncementError | null;
  warning: UploadWarning | null;
  /** True while something is running (validating, uploading or cancelling). */
  isBusy: boolean;
  /** Resolves with the result, or null when it failed or was cancelled. */
  start: (file: File) => Promise<UploadResult | null>;
  /** Abort, wait for the requests to settle, then DELETE the upload. */
  cancel: () => Promise<void>;
  /** Back to idle (cancels first if something is running). */
  reset: () => void;
}

const ZERO_PROGRESS: UploadProgress = {
  loaded: 0,
  total: 0,
  percent: 0,
  bytesPerSecond: null,
};

interface Run {
  id: number;
  controller: AbortController;
  /** The server's upload_uuid once init has answered. */
  uuid: string | null;
  /** The server has the whole file: nothing to cancel. */
  completed: boolean;
  /** cancel() / unmount took over: stop touching React state. */
  cancelled: boolean;
  /** Settles (never rejects) when the run's work is over. */
  promise: Promise<unknown>;
}

/** What the client refused before sending anything. */
function clientValidationError(
  code: MediaValidationCode,
  message: string,
): AnnouncementError {
  const apiCode =
    code === "unsupportedType"
      ? "UNSUPPORTED_TYPE"
      : code === "imageTooLarge"
        ? "IMAGE_TOO_LARGE"
        : "EMPTY_FILE";
  return makeClientError(code === "imageTooLarge" ? "tooLarge" : "validation", message, {
    code: apiCode,
    fieldErrors: { media: [message] },
  });
}

/** Byte progress across files/chunks, throttled, with a smoothed speed. */
function createTracker(total: number, emit: (p: UploadProgress) => void) {
  const bytes = new Map<number, number>();
  const samples: Array<{ t: number; loaded: number }> = [];
  let lastEmit = 0;

  const snapshot = (finished = false): UploadProgress => {
    let loaded = 0;
    for (const v of bytes.values()) loaded += v;
    loaded = Math.min(loaded, total);

    const now = Date.now();
    samples.push({ t: now, loaded });
    while (samples.length > 2 && now - samples[0].t > SPEED_WINDOW_MS) samples.shift();
    const first = samples[0];
    const dt = now - first.t;
    const bytesPerSecond =
      dt >= 500 && loaded > first.loaded ? ((loaded - first.loaded) * 1000) / dt : null;

    const raw = total > 0 ? Math.floor((loaded / total) * 100) : 0;
    return {
      loaded,
      total,
      percent: finished ? 100 : Math.min(99, raw),
      bytesPerSecond,
    };
  };

  const maybeEmit = (force = false) => {
    const now = Date.now();
    if (!force && now - lastEmit < PROGRESS_EMIT_MS) return;
    lastEmit = now;
    emit(snapshot());
  };

  return {
    /** Bytes of `key` sent so far (capped at its own size by the caller). */
    report(key: number, loaded: number) {
      bytes.set(key, loaded);
      maybeEmit();
    },
    /** A retry starts over: its bytes no longer count. */
    reset(key: number) {
      bytes.set(key, 0);
      maybeEmit(true);
    },
    complete(key: number, size: number) {
      bytes.set(key, size);
      maybeEmit(true);
    },
    clear() {
      bytes.clear();
      samples.length = 0;
      maybeEmit(true);
    },
    finish() {
      lastEmit = Date.now();
      emit(snapshot(true));
    },
  };
}

type ChunkOutcome =
  | { ok: true; result: VideoChunkComplete }
  | { ok: false; error: AnnouncementError; lastChunk: boolean };

export function useAnnouncementUpload(): UseAnnouncementUploadResult {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState<UploadProgress>(ZERO_PROGRESS);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<AnnouncementError | null>(null);
  const [warning, setWarning] = useState<UploadWarning | null>(null);

  const mountedRef = useRef(false);
  const runRef = useRef<Run | null>(null);
  const idRef = useRef(0);

  /** Run a state update only while `run` is still the live, uncancelled run. */
  const live = useCallback(
    (run: Run, update: () => void) => {
      if (mountedRef.current && runRef.current === run && !run.cancelled) update();
    },
    [],
  );

  const settleToIdle = useCallback(() => {
    setState("idle");
    setProgress(ZERO_PROGRESS);
    setResult(null);
    setError(null);
    setWarning(null);
  }, []);

  /* ── The work ────────────────────────────────────────────────────── */

  const uploadImage = useCallback(
    async (file: File, run: Run): Promise<UploadResult> => {
      const tracker = createTracker(file.size, (p) => live(run, () => setProgress(p)));
      tracker.reset(0);

      const uploaded = await withRetry(
        () => {
          tracker.reset(0);
          return announcementMediaService.uploadImage(file, {
            signal: run.controller.signal,
            onProgress: (loaded) => tracker.report(0, Math.min(loaded, file.size)),
          });
        },
        {
          signal: run.controller.signal,
          maxAttempts: 3,
          shouldRetry: isRetryableBeforeProcessing,
        },
      );

      if (!uploaded.media_path) {
        throw makeClientError(
          "server",
          "The server accepted the file but did not return a path for it. Please try again.",
          { code: "MISSING_MEDIA_PATH" },
        );
      }
      run.completed = true;
      tracker.finish();
      return {
        kind: uploaded.media_type,
        media_path: uploaded.media_path,
        media_url: uploaded.media_url,
        media_type: uploaded.media_type,
        width: null,
        height: null,
        duration_seconds: null,
        file_size: file.size,
        file_name: file.name,
      };
    },
    [live],
  );

  /** Chunks 0..N-2 through the pool, then the last one alone. */
  const sendChunks = useCallback(
    async (
      file: File,
      uuid: string,
      totalChunks: number,
      meta: { width?: number; height?: number; duration_seconds?: number } | undefined,
      run: Run,
      tracker: ReturnType<typeof createTracker>,
    ): Promise<ChunkOutcome> => {
      const lastIndex = totalChunks - 1;
      const sliceOf = (i: number) =>
        file.slice(i * VIDEO_CHUNK_SIZE, Math.min((i + 1) * VIDEO_CHUNK_SIZE, file.size));

      // ── Chunks 0..N-2: a pool of workers ──────────────────────────
      // A holder object, not a bare let: the workers assign it from closures.
      const pool: { failure: AnnouncementError | null } = { failure: null };
      const poolAbort = new AbortController();
      const poolSignal = anySignal([run.controller.signal, poolAbort.signal]);
      let next = 0;

      const worker = async () => {
        while (!pool.failure) {
          const index = next++;
          if (index >= lastIndex) return;
          const blob = sliceOf(index);
          try {
            await withRetry(
              () => {
                tracker.reset(index);
                return announcementMediaService.uploadChunk(uuid, index, blob, {
                  signal: poolSignal,
                  onProgress: (loaded) => tracker.report(index, Math.min(loaded, blob.size)),
                });
              },
              { signal: poolSignal },
            );
            tracker.complete(index, blob.size);
          } catch (err) {
            if (!pool.failure) {
              pool.failure = parseAnnouncementError(err, undefined, { context: "upload-chunk" });
              // Stop the other workers' requests and retry waits.
              poolAbort.abort();
            }
            return;
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(VIDEO_PARALLEL_CHUNKS, lastIndex) }, worker),
      );
      if (pool.failure) return { ok: false, error: pool.failure, lastChunk: false };
      if (run.controller.signal.aborted) {
        return {
          ok: false,
          error: makeClientError("cancelled", "Cancelled."),
          lastChunk: false,
        };
      }

      // ── The last chunk: alone, with the metadata ──────────────────
      const lastBlob = sliceOf(lastIndex);
      try {
        const answer = await withRetry(
          () => {
            tracker.reset(lastIndex);
            return announcementMediaService.uploadChunk(uuid, lastIndex, lastBlob, {
              meta,
              signal: run.controller.signal,
              onProgress: (loaded) => tracker.report(lastIndex, Math.min(loaded, lastBlob.size)),
              stallMs: LAST_CHUNK_STALL_MS,
            });
          },
          { signal: run.controller.signal, shouldRetry: isRetryableBeforeProcessing },
        );
        tracker.complete(lastIndex, lastBlob.size);

        if (answer.status !== "complete") {
          return {
            ok: false,
            lastChunk: true,
            error: makeClientError(
              "server",
              "The server has not finished assembling the video. Please upload it again.",
              { code: "UPLOAD_INCOMPLETE" },
            ),
          };
        }
        return { ok: true, result: answer };
      } catch (err) {
        return {
          ok: false,
          lastChunk: true,
          error: parseAnnouncementError(err, undefined, { context: "upload-chunk" }),
        };
      }
    },
    [],
  );

  const uploadVideo = useCallback(
    async (file: File, run: Run): Promise<UploadResult> => {
      // 1. Metadata. Never blocks.
      const metadata = await readVideoMetadata(file);
      if (!metadata.ok) {
        live(run, () =>
          setWarning({
            code: "videoMetadataUnavailable",
            reason: metadata.reason,
            message:
              "The browser couldn't read this video's size and length (some formats, like HEVC .mov, aren't readable here). You can still upload it.",
          }),
        );
      }
      const meta = metadata.ok
        ? {
            ...(metadata.width != null && { width: metadata.width }),
            ...(metadata.height != null && { height: metadata.height }),
            ...(metadata.durationSeconds != null && {
              duration_seconds: metadata.durationSeconds,
            }),
          }
        : undefined;

      const totalChunks = Math.max(1, Math.ceil(file.size / VIDEO_CHUNK_SIZE));
      const tracker = createTracker(file.size, (p) => live(run, () => setProgress(p)));
      live(run, () => setState("uploading"));

      let restarted = false;
      for (;;) {
        // 2. Init: the server's 422 (size / type) surfaces before any chunk.
        const init = await withRetry(
          () =>
            announcementMediaService.initVideo(
              {
                total_chunks: totalChunks,
                total_size: file.size,
                original_filename: file.name,
              },
              { signal: run.controller.signal },
            ),
          { signal: run.controller.signal },
        );
        if (!init.upload_uuid) {
          throw makeClientError(
            "server",
            "The server did not start the upload. Please try again.",
            { code: "MISSING_UPLOAD_UUID" },
          );
        }
        run.uuid = init.upload_uuid;
        tracker.clear();

        // 3 + 4. Chunks.
        const outcome = await sendChunks(file, init.upload_uuid, totalChunks, meta, run, tracker);

        if (outcome.ok) {
          run.completed = true;
          tracker.finish();
          const done = outcome.result;
          return {
            kind: "video",
            media_path: done.media_path,
            media_url: done.media_url,
            media_type: "video",
            width: done.width ?? (metadata.ok ? metadata.width : null),
            height: done.height ?? (metadata.ok ? metadata.height : null),
            duration_seconds:
              done.duration_seconds ?? (metadata.ok ? metadata.durationSeconds : null),
            file_size: done.file_size || file.size,
            file_name: file.name,
          };
        }

        // 5. The server forgot this upload before the last chunk: start over, once.
        if (outcome.error.kind === "uploadExpired" && !outcome.lastChunk && !restarted) {
          restarted = true;
          run.uuid = null;
          continue;
        }
        throw outcome.error;
      }
    },
    [live, sendChunks],
  );

  /* ── Public API ──────────────────────────────────────────────────── */

  const cancel = useCallback(async () => {
    const run = runRef.current;
    if (!run) {
      settleToIdle();
      return;
    }
    run.cancelled = true;
    if (mountedRef.current) setState("cancelling");
    run.controller.abort();
    // Let every in-flight request finish aborting before the DELETE, so a
    // late chunk can't land after it.
    await Promise.allSettled([run.promise]);

    if (run.uuid && !run.completed) {
      try {
        await announcementMediaService.cancelVideo(run.uuid);
      } catch {
        // Best effort: the server drops abandoned uploads after an hour.
      }
    }
    const stillCurrent = runRef.current === run;
    if (stillCurrent) runRef.current = null;
    // A newer upload may have started while this DELETE was running: leave its UI alone.
    if (mountedRef.current && (stillCurrent || runRef.current === null)) settleToIdle();
  }, [settleToIdle]);

  const start = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      if (runRef.current) await cancel();

      const id = ++idRef.current;
      const run: Run = {
        id,
        controller: new AbortController(),
        uuid: null,
        completed: false,
        cancelled: false,
        promise: Promise.resolve(),
      };
      runRef.current = run;

      setState("validating");
      setProgress({ ...ZERO_PROGRESS, total: file.size });
      setResult(null);
      setError(null);
      setWarning(null);

      const work = (async (): Promise<UploadResult | null> => {
        try {
          const refusal = validateMediaFile(file);
          if (refusal) throw clientValidationError(refusal.code, refusal.message);

          const kind = classifyFile(file);
          const done =
            kind === "video" ? await uploadVideo(file, run) : await uploadImage(file, run);
          if (run.cancelled) return null; // Cancel won the race with the last answer

          live(run, () => {
            setResult(done);
            setState("done");
          });
          return done;
        } catch (err) {
          const parsed = parseAnnouncementError(err);
          // A cancel is not a failure to report.
          if (parsed.kind !== "cancelled" && !run.cancelled) {
            live(run, () => {
              setError(parsed);
              setState("error");
            });
          }
          return null;
        } finally {
          if (runRef.current === run && !run.cancelled) runRef.current = null;
        }
      })();

      run.promise = work;
      return work;
    },
    [cancel, live, uploadImage, uploadVideo],
  );

  const reset = useCallback(() => {
    if (runRef.current) {
      void cancel();
      return;
    }
    settleToIdle();
  }, [cancel, settleToIdle]);

  /* ── Unmount and pagehide: stop, and tell the server with keepalive ── */

  useEffect(() => {
    mountedRef.current = true;

    const abandon = (updateState: boolean) => {
      const run = runRef.current;
      if (!run) return;
      run.cancelled = true;
      run.controller.abort();
      if (run.uuid && !run.completed) {
        void announcementMediaService.cancelVideo(run.uuid, { keepalive: true });
      }
      runRef.current = null;
      if (updateState && mountedRef.current) settleToIdle();
    };

    // The page may come back from the back/forward cache: it must not look
    // like it is still uploading then.
    const onPageHide = () => abandon(true);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", onPageHide);
      abandon(false);
    };
  }, [settleToIdle]);

  return {
    state,
    progress,
    result,
    error,
    warning,
    isBusy: state === "validating" || state === "uploading" || state === "cancelling",
    start,
    cancel,
    reset,
  };
}
