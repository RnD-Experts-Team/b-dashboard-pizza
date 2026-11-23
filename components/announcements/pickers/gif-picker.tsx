"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageOff, Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  GIF_PAGE_SIZE,
  announcementMediaService,
} from "@/lib/api/services/announcement-media.service";
import {
  parseAnnouncementError,
  type AnnouncementError,
} from "@/lib/announcements/errors";
import { safeMediaUrl } from "@/lib/announcements/media";
import type { GifResult } from "@/types/announcement.types";
import { AnnouncementErrorAlert } from "../shared/announcement-error-alert";

const SEARCH_DEBOUNCE_MS = 400;
/** Keep a very tall or very wide GIF from making a tile absurd. */
const MIN_RATIO = 0.5;
const MAX_RATIO = 2.5;

/** The aspect box of a GIF (width / height), clamped; 1 when the API sent no size. */
function ratioOf(gif: GifResult): number {
  const raw = gif.width > 0 && gif.height > 0 ? gif.width / gif.height : 1;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw));
}

/** Two columns, each new GIF going to the shorter one: a masonry with no layout shift. */
function toColumns(items: GifResult[]): GifResult[][] {
  const columns: GifResult[][] = [[], []];
  const heights = [0, 0];
  for (const gif of items) {
    const target = heights[0] <= heights[1] ? 0 : 1;
    columns[target].push(gif);
    heights[target] += 1 / ratioOf(gif);
  }
  return columns;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  One tile                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function GifTile({
  gif,
  label,
  onPick,
}: {
  gif: GifResult;
  label: string;
  onPick: (gif: GifResult) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onPick(gif)}
      aria-label={label}
      style={{ aspectRatio: ratioOf(gif) }}
      className="group relative block w-full overflow-hidden rounded-md bg-muted outline-none hover:ring-2 hover:ring-ring/50 focus-visible:ring-[3px] focus-visible:ring-ring/70"
    >
      {!loaded && !failed && <Skeleton className="absolute inset-0 rounded-none" aria-hidden />}
      {failed ? (
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <ImageOff className="size-5" aria-hidden />
        </span>
      ) : (
        // Giphy's own preview (a small animated GIF); the host is not ours to optimise.
        <img
          src={gif.preview_url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "size-full object-cover transition-opacity duration-200 motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Picker                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface GifPickerProps {
  /** The picked GIF. Save it as `{ media_path: gif.url, media_type: "gif" }`. */
  onSelect: (gif: GifResult) => void;
  /** Focus the search box on mount. Desktop only: on a phone it raises the keyboard. */
  autoFocusSearch?: boolean;
  className?: string;
}

/**
 * GIFs from the Notifications service's Giphy proxy (no API key on the client).
 *
 * Trending until the user types; search is debounced 400 ms (Enter searches at
 * once). Tiles are sized from each GIF's width/height, so nothing shifts as
 * they load. More load as the end comes into view (offset += 24). A failed
 * request shows the backend's message with a retry, and a 429 counts its
 * Retry-After down live. Giphy requires the attribution line at the bottom.
 */
export function GifPicker({ onSelect, autoFocusSearch = false, className }: GifPickerProps) {
  const t = useTranslations("announcements.pickers.gif");

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GifResult[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<AnnouncementError | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<AnnouncementError | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const offsetRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const request = useCallback(
    (q: string, offset: number, signal: AbortSignal) =>
      q
        ? announcementMediaService.searchGifs(q, { limit: GIF_PAGE_SIZE, offset }, signal)
        : announcementMediaService.trendingGifs({ limit: GIF_PAGE_SIZE, offset }, signal),
    [],
  );

  /** The first page for `q` (also what Retry runs). Replaces everything. */
  const loadFirst = useCallback(
    (q: string) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setPhase("loading");
      setError(null);
      setMoreError(null);
      setLoadingMore(false);
      setItems([]);
      setHasMore(false);
      offsetRef.current = 0;

      request(q, 0, controller.signal)
        .then((page) => {
          if (controller.signal.aborted) return;
          offsetRef.current = GIF_PAGE_SIZE;
          setItems(page);
          setHasMore(page.length >= GIF_PAGE_SIZE);
          setPhase("ready");
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          const parsed = parseAnnouncementError(err);
          if (parsed.kind === "cancelled") return;
          setError(parsed);
          setPhase("error");
        });
    },
    [request],
  );

  const loadMore = useCallback(() => {
    if (phase !== "ready" || loadingMore || !hasMore) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoadingMore(true);

    request(query, offsetRef.current, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        offsetRef.current += GIF_PAGE_SIZE;
        setItems((current) => {
          const known = new Set(current.map((g) => g.id));
          return [...current, ...page.filter((g) => !known.has(g.id))];
        });
        setHasMore(page.length >= GIF_PAGE_SIZE);
        setLoadingMore(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const parsed = parseAnnouncementError(err);
        setLoadingMore(false);
        if (parsed.kind !== "cancelled") setMoreError(parsed);
      });
  }, [phase, loadingMore, hasMore, query, request]);

  // Debounce the box into the query.
  useEffect(() => {
    const id = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [input]);

  // A new query starts a new list; leaving stops whatever is in flight.
  useEffect(() => {
    loadFirst(query);
    return () => controllerRef.current?.abort();
  }, [query, loadFirst]);

  // Infinite scroll: load the next page as the sentinel nears the viewport.
  // Re-created after every page so a sentinel that is STILL in view fires again.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !hasMore || phase !== "ready" || moreError) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreRef.current();
      },
      { root, rootMargin: "240px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [items.length, hasMore, phase, moreError]);

  const usable = useMemo(
    () => items.filter((g) => safeMediaUrl(g.preview_url) && safeMediaUrl(g.url)),
    [items],
  );
  const columns = useMemo(() => toColumns(usable), [usable]);
  const indexOf = useMemo(() => new Map(usable.map((g, i) => [g.id, i + 1])), [usable]);

  return (
    <div
      data-slot="gif-picker"
      className={cn("flex h-full min-h-0 w-full min-w-0 flex-col", className)}
    >
      <div className="p-2 pb-1">
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoFocus={autoFocusSearch}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                setQuery(input.trim());
              }
            }}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-8 w-full min-w-0 rounded-md border border-input bg-transparent ps-8 pe-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                setQuery("");
              }}
              aria-label={t("clear")}
              className="absolute end-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <X className="size-3" aria-hidden />
            </button>
          )}
        </div>
        <p className="mt-1.5 px-0.5 text-[11px] font-medium text-muted-foreground" aria-live="polite">
          {query ? t("resultsFor", { query }) : t("trending")}
        </p>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        {phase === "loading" && (
          <div className="flex gap-1.5" aria-hidden>
            {[
              [1.2, 0.8, 1],
              [0.9, 1.1, 0.8],
            ].map((column, c) => (
              <div key={c} className="flex min-w-0 flex-1 flex-col gap-1.5">
                {column.map((ratio, i) => (
                  <Skeleton key={i} className="w-full rounded-md" style={{ aspectRatio: ratio }} />
                ))}
              </div>
            ))}
          </div>
        )}

        {phase === "error" && (
          <AnnouncementErrorAlert
            error={error}
            title={t("loadFailed")}
            onRetry={() => loadFirst(query)}
            compact
            className="mt-1"
          />
        )}

        {phase === "ready" && usable.length === 0 && (
          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-1 px-4 text-center">
            <ImageOff className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {query ? t("noResults", { query }) : t("noTrending")}
            </p>
          </div>
        )}

        {usable.length > 0 && (
          <div className="flex gap-1.5">
            {columns.map((column, c) => (
              <div key={c} className="flex min-w-0 flex-1 flex-col gap-1.5">
                {column.map((gif) => (
                  <GifTile
                    key={gif.id}
                    gif={gif}
                    label={t("select", { n: indexOf.get(gif.id) ?? 0 })}
                    onPick={onSelect}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {moreError && (
          <AnnouncementErrorAlert
            error={moreError}
            onRetry={() => {
              setMoreError(null);
              loadMore();
            }}
            compact
            className="mt-2"
          />
        )}

        {loadingMore && (
          <div className="flex justify-center py-3" role="status" aria-label={t("loadingMore")}>
            <Loader2
              className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
              aria-hidden
            />
          </div>
        )}

        <div ref={sentinelRef} className="h-px" aria-hidden />
      </div>

      <p className="shrink-0 border-t px-2 py-1 text-center text-[10px] font-medium tracking-wide text-muted-foreground">
        {t("poweredBy")}
      </p>
    </div>
  );
}
