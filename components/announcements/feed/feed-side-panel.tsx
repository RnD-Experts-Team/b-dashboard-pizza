"use client";

import { CheckCheck, Loader2, Pin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Announcement } from "@/types/announcement.types";
import { SidePanelSkeleton } from "./feed-skeleton";
import {
  FeedSearch,
  TypeFilterList,
  type TypeCounts,
  type TypeFilter,
} from "./feed-filters";

export type FeedFilter = "all" | "unread";

export interface FeedSidePanelProps {
  total: number;
  unreadCount: number;
  filter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  onMarkAllRead: () => void;
  isMarkingSeen: boolean;
  /** Pinned announcements, in feed order. */
  pinned: readonly Announcement[];
  /** Scroll to a post (and open it if it is a compact row). */
  onJump: (id: number) => void;
  query: string;
  onQueryChange: (query: string) => void;
  typeFilter: TypeFilter;
  onTypeChange: (type: TypeFilter) => void;
  typeCounts: TypeCounts;
  /** The list is still loading: draw placeholders instead of empty zeros. */
  loading?: boolean;
  className?: string;
}

/**
 * The feed's side panel on wide screens: the search box, how many posts are unread,
 * "Mark all as read", the All / Unread and type filters, and a list of the pinned posts that jumps to
 * each one. It sticks to the top while the feed scrolls. On narrower pages the
 * same controls are the chip row above the feed, so this panel is hidden there
 * by the feed's container query.
 */
export function FeedSidePanel({
  total,
  unreadCount,
  filter,
  onFilterChange,
  onMarkAllRead,
  isMarkingSeen,
  pinned,
  onJump,
  query,
  onQueryChange,
  typeFilter,
  onTypeChange,
  typeCounts,
  loading = false,
  className,
}: FeedSidePanelProps) {
  const t = useTranslations("announcements.page");

  if (loading) {
    return (
      <aside aria-hidden className={cn("min-w-0", className)}>
        <div className="sticky top-4">
          <SidePanelSkeleton />
        </div>
      </aside>
    );
  }

  const filters: { key: FeedFilter; label: string; count: number }[] = [
    { key: "all", label: t("filters.all"), count: total },
    { key: "unread", label: t("filters.unread"), count: unreadCount },
  ];

  return (
    <aside aria-label={t("panel.label")} className={cn("min-w-0", className)}>
      <div className="sticky top-4 space-y-4">
        <FeedSearch value={query} onChange={onQueryChange} />

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {t("panel.title")}
          </h2>

          {unreadCount > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl font-bold tabular-nums">{unreadCount}</span>
              <span className="text-sm text-muted-foreground">{t("panel.unread")}</span>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCheck className="size-4 text-muted-foreground" aria-hidden />
              {t("caughtUpTitle")}
            </p>
          )}

          {unreadCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isMarkingSeen}
              onClick={onMarkAllRead}
              className="w-full gap-1.5"
            >
              {isMarkingSeen ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <CheckCheck aria-hidden />
              )}
              {t("panel.markAll")}
            </Button>
          )}

          <div role="group" aria-label={t("filters.label")} className="space-y-0.5 border-t pt-3">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => onFilterChange(item.key)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden motion-reduce:transition-none",
                  filter === item.key
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {item.label}
                <span className="text-xs tabular-nums">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5 border-t pt-3">
            <h3 className="px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t("type.label")}
            </h3>
            <TypeFilterList value={typeFilter} onChange={onTypeChange} counts={typeCounts} />
          </div>
        </section>

        {pinned.length > 0 && (
          <section className="space-y-2 rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <Pin className="size-3" aria-hidden />
              {t("panel.pinned")}
            </h2>
            <ul className="space-y-0.5">
              {pinned.map((announcement) => (
                <li key={announcement.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onJump(announcement.id)}
                    className="flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden motion-reduce:transition-none"
                  >
                    {announcement.seen === false && (
                      <span className="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate">{announcement.title}</span>
                    {announcement.seen === false && <span className="sr-only">{t("panel.unread")}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
