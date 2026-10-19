"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Star } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionError } from "@/components/maintenance-tickets/analytics/analytics-sections";
import { daysToInstants } from "@/lib/maintenance-tickets/local-range";
import { useScreenUsageTimeline } from "@/lib/hooks/use-screen-usage";
import { USAGE_COLORS, formatDuration, percent } from "@/lib/screen-usage/format";
import type { UsageUserRow } from "@/lib/screen-usage/types";
import { BreakdownChart } from "./usage-charts";
import { DayTimeline } from "./day-timeline";
import { MetricNote } from "./metric-definitions";
import { cn } from "@/lib/utils";

/**
 * Everything about one manager in the selected range — the numbers, where the
 * time went, their favourite screen — and any day of theirs minute by minute.
 */
export function ManagerSheet({
  user,
  stores,
  startDate,
  endDate,
  onClose,
}: {
  user: UsageUserRow | null;
  /** Store numbers in scope (the timeline is read across the same stores). */
  stores: string[];
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  const t = useTranslations("screenMonitoring");
  const [day, setDay] = useState(endDate);
  const dayInRange = day >= startDate && day <= endDate;
  const range = dayInRange ? daysToInstants(day, day) : null;

  const timeline = useScreenUsageTimeline(
    user && range ? { stores, userId: user.user_id, from: range.from, to: range.to } : null,
  );

  const camera = useMemo(
    () =>
      user
        ? [
            { label: t("legend.present"), seconds: user.present, color: USAGE_COLORS.good },
            { label: t("legend.noFace"), seconds: user.no_face, color: USAGE_COLORS.attention },
            { label: t("legend.covered"), seconds: user.covered, color: USAGE_COLORS.problem },
            { label: t("legend.cameraOff"), seconds: user.camera_off, color: USAGE_COLORS.off },
          ]
        : [],
    [user, t],
  );

  const stats: { label: string; value: string; note?: string; warn?: boolean }[] = user
    ? [
        { label: t("columns.onScreen"), value: formatDuration(user.on_screen), note: t("visits", { count: user.visits }) },
        { label: t("columns.present"), value: percent(user.present, user.on_screen), note: formatDuration(user.present) },
        { label: t("columns.away"), value: formatDuration(user.away) },
        { label: t("columns.micOpen"), value: formatDuration(user.mic_open) },
        { label: t("columns.talking"), value: formatDuration(user.talking), note: t("ofMic", { share: percent(user.talking, user.mic_open) }) },
        { label: t("columns.silent"), value: formatDuration(user.silent) },
        { label: t("columns.deadMic"), value: formatDuration(user.dead_mic), warn: user.dead_mic > 0 },
        { label: t("columns.talkAll"), value: formatDuration(user.talk_all), note: t("talkingFor", { duration: formatDuration(user.talk_all_talking) }) },
        { label: t("columns.pip"), value: formatDuration(user.pip) },
        { label: t("columns.kicks"), value: String(user.kicks), warn: user.kicks > 0 },
      ]
    : [];

  return (
    <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {user && (
          <>
            <SheetHeader className="sticky top-0 z-10 border-b bg-background/95 px-6 py-5 pe-12 backdrop-blur">
              <SheetTitle className="font-heading text-xl">{user.name}</SheetTitle>
              <SheetDescription>
                {user.stores.join(", ")} ·{" "}
                {t("lastSeen", {
                  at: new Date(user.last_seen).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
                })}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-6 py-6">
              <SheetSection title={t("sections.figures")}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {stats.map((s) => (
                    <div key={s.label} className="rounded-lg border bg-muted/20 px-3 py-2.5">
                      <p className="truncate text-xs font-medium text-muted-foreground">{s.label}</p>
                      <p className={cn("mt-1 font-heading text-xl font-semibold tabular-nums", s.warn && "text-red-600 dark:text-red-400")}>
                        {s.value}
                      </p>
                      {s.note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.note}</p>}
                    </div>
                  ))}
                </div>
                {user.favorite && (
                  <div className="mt-4 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm">
                    <Star className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                    <span>
                      {t("favoriteLine", {
                        screen: user.favorite.name,
                        store: user.favorite.store ?? "",
                        duration: formatDuration(user.favorite.seconds),
                      })}
                    </span>
                  </div>
                )}
                <div className="mt-4 space-y-1.5 border-t pt-4">
                  <MetricNote metric="connected" />
                  <MetricNote metric="talking" />
                  <MetricNote metric="deadMic" />
                </div>
              </SheetSection>

              <SheetSection title={t("sections.camera")}>
                <BreakdownChart slices={camera} totalLabel={t("columns.onScreen")} />
                <div className="mt-4 space-y-1.5 border-t pt-4">
                  <MetricNote metric="present" />
                  <MetricNote metric="noFace" />
                  <MetricNote metric="covered" />
                </div>
              </SheetSection>

              <SheetSection
                title={t("sections.dayTimeline")}
                action={<DatePicker value={day} onChange={(v) => v && setDay(v)} className="w-40" />}
              >
                {!dayInRange ? (
                  <p className="text-sm text-muted-foreground">{t("dayOutOfRange")}</p>
                ) : timeline.error ? (
                  <SectionError message={t("loadError")} />
                ) : timeline.isLoading && !timeline.data ? (
                  <Skeleton className="h-72 w-full" />
                ) : (
                  range && (
                    <div className={timeline.isLoading ? "opacity-60" : undefined}>
                      <DayTimeline segments={timeline.data ?? []} dayStart={Date.parse(range.from)} dayEnd={Date.parse(range.to)} />
                    </div>
                  )
                )}
                {user.kicks > 0 && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                    {t("kicksHint")}
                  </p>
                )}
              </SheetSection>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** A bordered block of the sheet: a title row, then its content. */
function SheetSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
