import { Skeleton } from "@/components/ui/skeleton";
import { PostSkeleton } from "./post-skeleton";

/**
 * Loading placeholders for the user's feed. They have the shape of what is about
 * to arrive: the grey tray, a full post, compact rows under a date heading, and
 * the side panel (search, summary, filters, pinned), so nothing jumps when the
 * real thing replaces them.
 */

/** One compact row: thumbnail, title + one line of text, "General - time", likes, arrow. */
export function CompactRowSkeleton({ thumbnail = true }: { thumbnail?: boolean }) {
  return (
    <div aria-hidden className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs">
      {thumbnail && <Skeleton className="size-12 shrink-0 rounded-md" />}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Skeleton className="hidden h-3.5 w-24 sm:block" />
        <Skeleton className="h-3.5 w-6" />
        <Skeleton className="size-4 rounded-sm" />
      </div>
    </div>
  );
}

/** The tray with a heading and a full post, then a date heading and three rows. */
export function FeedTraySkeleton() {
  return (
    <div
      aria-hidden
      data-slot="feed-tray-skeleton"
      className="space-y-6 rounded-2xl border bg-muted/30 p-3 sm:p-4"
    >
      <section className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <PostSkeleton withMedia />
      </section>
      <section className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <CompactRowSkeleton />
        <CompactRowSkeleton thumbnail={false} />
        <CompactRowSkeleton />
      </section>
    </div>
  );
}

/** The wide-screen side panel: search, the summary card, and the pinned card. */
export function SidePanelSkeleton() {
  return (
    <div aria-hidden data-slot="side-panel-skeleton" className="space-y-4">
      <Skeleton className="h-9 w-full rounded-md" />

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-full rounded-md" />

        <div className="space-y-1.5 border-t pt-3">
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
        </div>

        <div className="space-y-1.5 border-t pt-3">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
      </div>

      <div className="space-y-2 rounded-xl border bg-card p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </div>
  );
}

/**
 * The whole feed area (the page's loading fallback): the same grid as the real
 * feed, so the tray takes 65% and the panel the rest on a wide page, and a
 * single column with the chip row on a narrow one.
 */
export function FeedPageSkeleton() {
  return (
    <div aria-busy data-slot="feed-page-skeleton" className="@container/feed w-full">
      <div className="grid w-full max-w-2xl items-start gap-6 @4xl/feed:max-w-none @4xl/feed:grid-cols-[65%_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <div aria-hidden className="flex gap-2 @4xl/feed:hidden">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <FeedTraySkeleton />
        </div>
        <div className="hidden min-w-0 @4xl/feed:block">
          <SidePanelSkeleton />
        </div>
      </div>
    </div>
  );
}
