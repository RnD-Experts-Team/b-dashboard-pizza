"use client";

import { useLocale, useTranslations } from "next-intl";
import { CloudOff, Info, RotateCw } from "lucide-react";
import type { FeedSource } from "@/lib/calendar/feed-types";

/**
 * A slim note under the toolbar for partial results: feeds that couldn't load
 * (the rest still render), a feed that hit its cap, or a line about the view
 * itself (`note`, already translated). Neutral on purpose — the calendar keeps
 * red for overdue/missed. Renders nothing when there is nothing to say.
 */
export function FeedNotice({
  failed,
  truncated,
  note,
  onRetry,
}: {
  failed: readonly FeedSource[];
  truncated: boolean;
  note?: string;
  onRetry: () => void;
}) {
  const t = useTranslations("calendar.feed");
  const locale = useLocale();
  if (!failed.length && !truncated && !note) return null;

  const names = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
    failed.map((s) => t(`sources.${s}`)),
  );

  return (
    <div
      role="status"
      data-slot="calendar-feed-notice"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
    >
      {failed.length > 0 && (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <CloudOff className="size-3.5 shrink-0" />
          <span className="min-w-0">{t("unavailable", { names })}</span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1 rounded px-1 font-medium text-foreground outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <RotateCw className="size-3" />
            {t("retry")}
          </button>
        </span>
      )}
      {truncated && (
        <span className="inline-flex items-center gap-1.5">
          <Info className="size-3.5 shrink-0" />
          {t("truncated")}
        </span>
      )}
      {note && (
        <span className="inline-flex items-center gap-1.5">
          <Info className="size-3.5 shrink-0" />
          {note}
        </span>
      )}
    </div>
  );
}

/**
 * Month view with many stores: every feed answers with full events, so the page
 * is heavy (~4-9 MB for 44 stores). The request is still ONE per feed; instead
 * of splitting it, the Week view is suggested (FRONTEND_CALENDAR_REQUESTS.md §5).
 * Same slim, neutral style as `FeedNotice`.
 */
export function ManyStoresNote({ count, onWeek }: { count: number; onWeek: () => void }) {
  const t = useTranslations("calendar.feed");
  return (
    <div
      role="status"
      data-slot="calendar-many-stores-note"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Info className="size-3.5 shrink-0" />
        <span className="min-w-0">{t("manyStores", { n: count })}</span>
      </span>
      <button
        type="button"
        onClick={onWeek}
        className="inline-flex shrink-0 items-center gap-1 rounded px-1 font-medium text-foreground outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {t("switchToWeek")}
      </button>
    </div>
  );
}
