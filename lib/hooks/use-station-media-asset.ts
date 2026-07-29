"use client";

import { useEffect, useRef, useState } from "react";
import type { StationMedia } from "@/types/screen-project-media.types";

/**
 * Rewrites an external station-media URL to our same-origin proxy so the browser
 * is allowed to load it (the CSP blocks cross-origin <video>) and so we can cache
 * the bytes. Relative / already-local URLs are returned untouched. See the proxy
 * route at app/api/public/screen-project/media/route.ts.
 */
export function stationMediaSrc(url: string): string {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  return `/api/public/screen-project/media?src=${encodeURIComponent(url)}`;
}

const CACHE_NAME = "station-media-v1";

export interface StationMediaAsset {
  /** The media currently shown (only updates once its bytes are ready). */
  media: StationMedia | null;
  /** Object URL (or same-origin proxied URL) to feed the <img>/<video>. */
  src: string | null;
  /** 0..1 while a not-yet-cached asset downloads; null when idle or size unknown. */
  progress: number | null;
  /** True while fetching a new asset that isn't shown yet. */
  isDownloading: boolean;
}

interface Displayed {
  media: StationMedia;
  src: string;
  /** Whether src is an object URL we own and must revoke. */
  isObjectUrl: boolean;
}

async function readCache(url: string): Promise<Blob | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(url);
    return res ? await res.blob() : null;
  } catch {
    return null;
  }
}

async function writeCache(url: string, blob: Blob): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      url,
      new Response(blob, {
        headers: { "Content-Type": blob.type || "application/octet-stream" },
      }),
    );
  } catch {
    /* quota exceeded / unavailable — non-fatal, we just won't persist it */
  }
}

/**
 * Resolves the station's primary media into a ready-to-render source.
 *
 *  - Downloads the asset once through the same-origin proxy, into a Blob, and
 *    stores it in the Cache Storage API so it survives page refreshes and is
 *    never re-downloaded when the camera toggles on/off (the <video> re-mounts
 *    against the same in-memory blob URL).
 *  - Reports download `progress` so the UI can show a soft indicator.
 *  - Graceful swap: while a *different* primary downloads, the previously shown
 *    asset stays on screen; we swap only once the new one is fully ready. A
 *    broken asset is never swapped in.
 */
export function useStationMediaAsset(
  primaryMedia: StationMedia | null,
  options?: { enabled?: boolean },
): StationMediaAsset {
  // When disabled we don't START new downloads (e.g. while the LiveKit
  // connection is still establishing, so a large media fetch doesn't compete
  // with the WebRTC handshake), but we keep whatever is already showing.
  const enabled = options?.enabled ?? true;

  const [displayed, setDisplayed] = useState<Displayed | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const displayedRef = useRef<Displayed | null>(null);
  displayedRef.current = displayed;

  // The media id we're currently loading — lets us ignore a stale download that
  // resolves after a newer primary has taken over.
  const pendingIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Nothing to show.
    if (!primaryMedia) {
      pendingIdRef.current = null;
      setIsDownloading(false);
      setProgress(null);
      const cur = displayedRef.current;
      if (cur?.isObjectUrl) URL.revokeObjectURL(cur.src);
      setDisplayed(null);
      return;
    }

    // Paused (e.g. connection not yet established) — keep the current asset on
    // screen but don't kick off a new download yet.
    if (!enabled) return;

    // Already showing this exact media — keep it. This is what makes a camera
    // on/off toggle reuse the loaded blob instead of re-downloading.
    if (displayedRef.current && displayedRef.current.media.id === primaryMedia.id) {
      pendingIdRef.current = null;
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    pendingIdRef.current = primaryMedia.id;
    setIsDownloading(true);
    setProgress(null);

    const proxied = stationMediaSrc(primaryMedia.url);

    const finish = (src: string, isObjectUrl: boolean) => {
      if (cancelled || pendingIdRef.current !== primaryMedia.id) {
        if (isObjectUrl) URL.revokeObjectURL(src);
        return;
      }
      const prev = displayedRef.current;
      setDisplayed({ media: primaryMedia, src, isObjectUrl });
      if (prev?.isObjectUrl && prev.src !== src) URL.revokeObjectURL(prev.src);
      setIsDownloading(false);
      setProgress(null);
    };

    (async () => {
      // 1) Cache hit → instant, no network.
      const cached = await readCache(proxied);
      if (cancelled || pendingIdRef.current !== primaryMedia.id) return;
      if (cached) {
        finish(URL.createObjectURL(cached), true);
        return;
      }

      // 2) Download with progress, then cache.
      try {
        const res = await fetch(proxied, { signal: controller.signal });
        if (!res.ok || !res.body) throw new Error("bad response");

        const total = Number(res.headers.get("Content-Length")) || 0;
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        let lastPct = -1; // throttle re-renders to whole-percent changes
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (total > 0 && !cancelled && pendingIdRef.current === primaryMedia.id) {
              const pct = Math.floor((received / total) * 100);
              if (pct !== lastPct) {
                lastPct = pct;
                setProgress(received / total);
              }
            }
          }
        }
        if (cancelled || pendingIdRef.current !== primaryMedia.id) return;

        const type =
          res.headers.get("Content-Type") || primaryMedia.mime_type || undefined;
        const blob = new Blob(chunks as BlobPart[], type ? { type } : undefined);
        void writeCache(proxied, blob);
        finish(URL.createObjectURL(blob), true);
      } catch {
        if (cancelled || pendingIdRef.current !== primaryMedia.id) return;
        // Fallback: let the element load the proxied URL directly. Still
        // same-origin and CSP-safe; just without our blob cache / progress.
        finish(proxied, false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryMedia?.id, primaryMedia?.url, primaryMedia?.type, enabled]);

  // Revoke any owned object URL on unmount.
  useEffect(() => {
    return () => {
      const cur = displayedRef.current;
      if (cur?.isObjectUrl) URL.revokeObjectURL(cur.src);
    };
  }, []);

  return {
    media: displayed?.media ?? null,
    src: displayed?.src ?? null,
    progress,
    isDownloading,
  };
}
