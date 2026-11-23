"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { CheckCheck, Info, Loader2, Megaphone, Pin, SearchX, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { matchesQuery } from "@/lib/announcements/text";
import { normalizeAnnouncementType } from "@/types/announcement.types";
import { selectUnreadCount, useAnnouncementStore } from "@/lib/store/announcement.store";
import { AnnouncementErrorAlert } from "../shared/announcement-error-alert";
import { AnnouncementPost } from "./announcement-post";
import { AnnouncementPostCompact } from "./announcement-post-compact";
import { ExpandableSlot } from "./expandable-slot";
import {
  FeedSearch,
  TypeFilterSelect,
  type TypeCounts,
  type TypeFilter,
} from "./feed-filters";
import { FeedSidePanel, type FeedFilter } from "./feed-side-panel";
import { PostSkeleton } from "./post-skeleton";

type Filter = FeedFilter;

/** How long the deep-link ring stays on the post a notification brought you to. */
const HIGHLIGHT_MS = 2600;

/** Posts drawn at first, and added each time the list runs out. */
const PAGE_SIZE = 10;

export interface AnnouncementFeedProps {
  /** `?announcement=ID`: scroll to this post once the feed has loaded, and ring it. */
  deepLinkId?: number | null;
  className?: string;
}

/**
 * The user's feed (the "User view" of the Announcements page): the visible
 * announcements as posts, with All / Unread chips, "Mark all as read", skeleton
 * posts while loading, an empty state, and the error alert with Retry.
 *
 * Unread posts are drawn open. A post that was already read when the feed loaded
 * is one compact row that opens on press (it stays open, and a post you mark as
 * read while reading does not fold up under you). Pinned posts come first, under
 * their own heading. From 56 rem of page width the controls move into a side panel
 * (search, unread count, Mark all as read, All / Unread, type, the pinned posts).
 *
 * Only the first ten posts are drawn; more are added as the end of the list nears
 * (or with "Show more"), so a long feed does not render every picture at once.
 * Search looks at the title and the text; the type filter is General / Maintenance
 * / Urgent. All filters work on what was loaded.
 *
 * A notification link (`?announcement=ID`) scrolls to that post once the list
 * has loaded and rings it for a moment; if the announcement is no longer
 * visible to this user, a note says so instead of leaving them guessing.
 */
export function AnnouncementFeed({ deepLinkId = null, className }: AnnouncementFeedProps) {
  const t = useTranslations("announcements.page");
  const reduceMotion = useReducedMotion();

  const feed = useAnnouncementStore((s) => s.feed);
  const loadFeed = useAnnouncementStore((s) => s.loadFeed);
  const markSeen = useAnnouncementStore((s) => s.markSeen);
  const isMarkingSeen = useAnnouncementStore((s) => s.isMarkingSeen);
  const unreadCount = useAnnouncementStore(selectUnreadCount);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [linkMissing, setLinkMissing] = useState(false);
  const handledLink = useRef<number | null>(null);
  // The store keeps the list from an earlier visit; the deep link waits for THIS visit's load.
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Compact rows that were opened, and the post a jump is waiting to scroll to.
  const [opened, setOpened] = useState<ReadonlySet<number>>(() => new Set());
  // Posts that were unread at load and have been folded after being read.
  const [folded, setFolded] = useState<ReadonlySet<number>>(() => new Set());
  // Ever folded: such a post is not "arriving" when it opens again, so no fade-up.
  const everFolded = useRef(new Set<number>());
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);
  // Whether each post was already read the FIRST time the feed showed it.
  const readAtLoad = useRef(new Map<number, boolean>());

  useEffect(() => {
    const controller = new AbortController();
    void loadFeed(controller.signal).then(() => {
      if (!controller.signal.aborted) setLoadedOnce(true);
    });
    return () => controller.abort();
  }, [loadFeed]);

  const { items, status } = feed;
  const unread = items.filter((a) => !a.seen);
  const typeOf = (a: (typeof items)[number]) => normalizeAnnouncementType(a.type);
  const filtered = items.filter(
    (a) =>
      (filter === "all" || !a.seen) &&
      (typeFilter === "all" || typeOf(a) === typeFilter) &&
      matchesQuery(a, query),
  );
  const typeCounts: TypeCounts = { all: items.length, general: 0, maintenance: 0, urgent: 0 };
  for (const a of items) typeCounts[typeOf(a)] += 1;
  const filtersActive = query.trim() !== "" || typeFilter !== "all";

  for (const a of items) {
    if (!readAtLoad.current.has(a.id)) readAtLoad.current.set(a.id, a.seen === true);
  }
  const isCompact = (id: number) =>
    folded.has(id) || (readAtLoad.current.get(id) === true && !opened.has(id));

  // Pinned first; only the first `shown` are drawn.
  const ordered = [
    ...filtered.filter((a) => a.is_pinned),
    ...filtered.filter((a) => !a.is_pinned),
  ];
  const shownList = ordered.slice(0, shown);
  const pinned = shownList.filter((a) => a.is_pinned);
  const others = shownList.filter((a) => !a.is_pinned);
  const remaining = ordered.length - shownList.length;
  const allPinned = items.filter((a) => a.is_pinned);

  const clearFilters = () => {
    setFilter("all");
    setQuery("");
    setTypeFilter("all");
  };

  const openPost = useCallback((id: number) => {
    setOpened((current) => (current.has(id) ? current : new Set(current).add(id)));
    setFolded((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);
  const closePost = useCallback((id: number) => {
    everFolded.current.add(id);
    setOpened((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    // Read at load: it was a row until opened, so closing is "not opened". Unread at
    // load: it was never a row, so it has to be listed as folded.
    if (readAtLoad.current.get(id) !== true) {
      setFolded((current) => (current.has(id) ? current : new Set(current).add(id)));
    }
  }, []);

  /** Open the post (if it is a row), show it under any filter, scroll to it and ring it. */
  const focusPost = useCallback(
    (id: number) => {
      openPost(id);
      setFilter("all");
      setQuery("");
      setTypeFilter("all");
      setPendingFocus(id);
    },
    [openPost],
  );

  // A new filter or search starts the list again from the top.
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [filter, query, typeFilter]);

  // Draw more as the end of the list comes near.
  useEffect(() => {
    if (remaining <= 0) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShown((n) => n + PAGE_SIZE);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [remaining, shown]);

  /* ── The notification deep link ─────────────────────────────────────── */
  useEffect(() => {
    if (deepLinkId == null || !loadedOnce || status !== "success" || handledLink.current === deepLinkId) {
      return;
    }

    if (!items.some((a) => a.id === deepLinkId)) {
      handledLink.current = deepLinkId;
      setLinkMissing(true);
      return;
    }
    handledLink.current = deepLinkId;
    focusPost(deepLinkId);
  }, [deepLinkId, loadedOnce, status, items, focusPost]);

  // Scroll once the post is drawn open (a compact row is swapped for the full post first).
  useEffect(() => {
    if (pendingFocus === null) return;
    // While a row is folding away both it and the open post carry the id: take the open one.
    const el = document.querySelector<HTMLElement>(
      `#announcement-${pendingFocus}:not([data-compact="true"])`,
    );
    if (!el) {
      // Further down than what is drawn: draw down to it.
      const index = ordered.findIndex((a) => a.id === pendingFocus);
      if (index >= shown) setShown(index + 1);
      return;
    }
    setPendingFocus(null);
    el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    setHighlightId(pendingFocus);
  }, [pendingFocus, opened, folded, items, filter, reduceMotion, ordered, shown]);

  useEffect(() => {
    if (highlightId === null) return;
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const loading = (status === "loading" || status === "idle") && items.length === 0;

  const renderPost = (announcement: (typeof items)[number], index: number) => {
    const compact = isCompact(announcement.id);
    // A read post (read when the feed loaded, or marked read since) can be folded.
    const read = announcement.seen === true;
    // Arriving for the first time gets the list's fade-up; opening again does not.
    const arriving =
      readAtLoad.current.get(announcement.id) !== true && !everFolded.current.has(announcement.id);

    const post = compact ? (
      <AnnouncementPostCompact
        announcement={announcement}
        index={index}
        onExpand={() => openPost(announcement.id)}
      />
    ) : (
      <AnnouncementPost
        announcement={announcement}
        index={arriving ? index : undefined}
        highlight={highlightId === announcement.id}
        onCollapse={read ? () => closePost(announcement.id) : undefined}
      />
    );

    // Every post sits in a slot, so folding and opening is animated (and a post
    // keeps the same place in the tree when "Mark as read" makes it foldable).
    return (
      <ExpandableSlot key={announcement.id} expanded={!compact}>
        {post}
      </ExpandableSlot>
    );
  };

  return (
    <div data-slot="announcement-feed" className={cn("@container/feed w-full", className)}>
      {/* The container is as wide as the page; this inner box is what narrows it. Left-aligned. */}
      <div className="grid w-full max-w-2xl items-start gap-6 @4xl/feed:max-w-none @4xl/feed:grid-cols-[65%_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
      {/* Chips + Mark all as read (the side panel carries these on wide pages) */}
      <div className="flex flex-wrap items-center gap-2 @4xl/feed:hidden">
        <div role="group" aria-label={t("filters.label")} className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={filter === "all" ? "secondary" : "ghost"}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
            className="gap-1.5"
          >
            {t("filters.all")}
            {items.length > 0 && (
              <span className="min-w-5 rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
                {items.length}
              </span>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "unread" ? "secondary" : "ghost"}
            aria-pressed={filter === "unread"}
            onClick={() => setFilter("unread")}
            className="gap-1.5"
          >
            {t("filters.unread")}
            {unreadCount > 0 && (
              <span className="min-w-5 rounded-full bg-blue-500/15 px-1.5 text-[11px] font-semibold text-blue-600 tabular-nums dark:text-blue-400">
                {unreadCount}
              </span>
            )}
          </Button>
        </div>

        {unreadCount > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isMarkingSeen}
            onClick={() => void markSeen(unread.map((a) => a.id))}
            className="ms-auto gap-1.5"
          >
            {isMarkingSeen ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <CheckCheck aria-hidden />
            )}
            {t("markAllRead", { count: unreadCount })}
          </Button>
        )}
      </div>

      {/* Search + type (the side panel carries these on wide pages) */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 @4xl/feed:hidden">
          <FeedSearch value={query} onChange={setQuery} short className="flex-1" />
          <TypeFilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            counts={typeCounts}
            className="w-36 shrink-0 sm:w-44"
          />
        </div>
      )}

      {/* A link that points at an announcement this user can't see */}
      {linkMissing && (
        <Alert>
          <Info className="size-4" aria-hidden />
          <AlertDescription className="flex items-start justify-between gap-2">
            <span className="min-w-0 break-words">{t("linkedMissing")}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setLinkMissing(false)}
              className="-me-1 shrink-0"
            >
              <X aria-hidden />
              <span className="sr-only">{t("dismiss")}</span>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {status === "error" && (
        <AnnouncementErrorAlert
          error={feed.error}
          title={t("loadError")}
          onRetry={() => void loadFeed()}
        />
      )}

      {loading && (
        <div className="space-y-4" aria-busy aria-label={t("loading")}>
          <PostSkeleton withMedia />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      )}

      {/* Nothing is visible to this user */}
      {status === "success" && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-20 text-center">
          <Megaphone className="size-10 text-muted-foreground/50" aria-hidden />
          <div className="space-y-1">
            <p className="font-heading text-base font-medium">{t("emptyTitle")}</p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">{t("emptyHint")}</p>
          </div>
        </div>
      )}

      {/* Everything has been read */}
      {items.length > 0 && filter === "unread" && unread.length === 0 && !filtersActive && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
          <CheckCheck className="size-9 text-muted-foreground/60" aria-hidden />
          <div className="space-y-1">
            <p className="font-heading text-base font-medium">{t("caughtUpTitle")}</p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">{t("caughtUpHint")}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setFilter("all")}>
            {t("showAll")}
          </Button>
        </div>
      )}

      {/* The filters or the search leave nothing */}
      {items.length > 0 && filtered.length === 0 && !(filter === "unread" && unread.length === 0 && !filtersActive) && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
          <SearchX className="size-9 text-muted-foreground/60" aria-hidden />
          <div className="space-y-1">
            <p className="font-heading text-base font-medium">{t("noMatchTitle")}</p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">{t("noMatchHint")}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
            {t("clearFilters")}
          </Button>
        </div>
      )}

      {/* Said aloud when the search or filters change the count */}
      <p role="status" className="sr-only">
        {items.length > 0 ? t("results", { count: ordered.length }) : ""}
      </p>

      {ordered.length > 0 && (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <section aria-labelledby="feed-pinned" className="space-y-3">
              <h2
                id="feed-pinned"
                className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
              >
                <Pin className="size-3" aria-hidden />
                {t("sections.pinned")}
              </h2>
              {pinned.map((announcement, index) => renderPost(announcement, index))}
            </section>
          )}

          {others.length > 0 && (
            <section
              aria-labelledby={pinned.length > 0 ? "feed-latest" : undefined}
              className="space-y-3"
            >
              {pinned.length > 0 && (
                <h2
                  id="feed-latest"
                  className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  {t("sections.latest")}
                </h2>
              )}
              {others.map((announcement, index) => renderPost(announcement, pinned.length + index))}
            </section>
          )}

          {remaining > 0 && (
            <div ref={sentinelRef} className="flex justify-center pb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShown((n) => n + PAGE_SIZE)}
              >
                {t("showMore", { count: remaining })}
              </Button>
            </div>
          )}
        </div>
      )}
      </div>

      <FeedSidePanel
        total={items.length}
        unreadCount={unreadCount}
        filter={filter}
        onFilterChange={setFilter}
        onMarkAllRead={() => void markSeen(unread.map((a) => a.id))}
        isMarkingSeen={isMarkingSeen}
        pinned={allPinned}
        onJump={focusPost}
        query={query}
        onQueryChange={setQuery}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        typeCounts={typeCounts}
        className="hidden @4xl/feed:block @4xl/feed:self-stretch"
      />
      </div>
    </div>
  );
}
