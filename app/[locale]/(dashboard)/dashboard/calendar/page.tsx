import { redirect } from "next/navigation";

/*
 * CALENDAR HIDDEN FOR NOW (2026-11-24): the page is parked so none of its
 * 8 feed requests (or the Toolbox reminders/people calls) run, even when the
 * URL is opened directly or a calendar notification is clicked. To restore,
 * delete this redirect, uncomment the original route below (it needs
 * "use client" back at the top of the file), and uncomment the sidebar item,
 * the bottom-nav entry and the topbar button.
 */
export default async function CalendarRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}

// "use client";
//
// import { Suspense } from "react";
// import { Skeleton } from "@/components/ui/skeleton";
// import { CalendarPage } from "@/components/calendar/calendar-page";
//
// /**
//  * Calendar — opened from the sidebar's Toolbox group and from the topbar's
//  * calendar button (next to Drive-Thru). `?view=` / `?date=` live in the URL,
//  * which `useSearchParams` reads, hence the Suspense boundary.
//  */
// export default function CalendarRoute() {
//   return (
//     <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-xl" />}>
//       <CalendarPage />
//     </Suspense>
//   );
// }
