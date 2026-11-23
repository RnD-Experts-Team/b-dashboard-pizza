import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * A full post: the media block, then the title with "General - time" on the
 * same row, the text, the visible window, and the like / comments / mark-as-read row.
 */
export function PostSkeleton({
  withMedia = false,
  className,
}: {
  withMedia?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      data-slot="post-skeleton"
      className={cn("overflow-hidden rounded-2xl border bg-card shadow-xs", className)}
    >
      {withMedia && <Skeleton className="h-44 w-full rounded-none sm:h-56" />}
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="mt-1 h-3.5 w-28 shrink-0" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-8/12" />
        </div>
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="flex items-center gap-2 border-t px-3 py-2.5">
        <Skeleton className="h-7 w-14 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="ms-auto h-7 w-28 rounded-md" />
      </div>
    </div>
  );
}
