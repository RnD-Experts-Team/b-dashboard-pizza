"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarPage } from "@/components/calendar/calendar-page";

/**
 * Calendar — opened from the sidebar's Toolbox group and from the topbar's
 * calendar button (next to Drive-Thru). `?view=` / `?date=` live in the URL,
 * which `useSearchParams` reads, hence the Suspense boundary.
 */
export default function CalendarRoute() {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-xl" />}>
      <CalendarPage />
    </Suspense>
  );
}
