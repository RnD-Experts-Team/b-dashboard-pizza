import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/** A post-shaped placeholder: the media block, the pill + time row, the title, the text. */
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
      {withMedia && <Skeleton className="aspect-video w-full rounded-none" />}
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="ms-auto h-3.5 w-14" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-8/12" />
        </div>
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="flex items-center gap-2 border-t px-3 py-2.5">
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
    </div>
  );
}
