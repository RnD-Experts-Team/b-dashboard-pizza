"use client";

import Link from "next/link";
import { CalendarClock, ClipboardList, MapPin, Package, Plus, ScanSearch, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutes, formatMoney, formatQuantity } from "@/lib/maintenance/money";
import { INSPECTION_STATUSES, VISIT_TASK_STATUSES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import type { IssueSchedule, IssueVisit, TicketIssueDetail } from "@/types/maintenance-system";
import { AttachmentGallery } from "../attachment-gallery";
import { LocalTimestamp } from "../local-timestamp";
import { liveSchedules } from "./dialogs/booking-dialogs";
import { formatDay, formatDayTime } from "./format";

const TASK_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  done: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  not_done: "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

const INSPECTION_TONE: Record<string, string> = {
  scheduled: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

const PILL = "rounded-full px-2 py-0.5 text-[11px] font-medium";
const MS_PER_MINUTE = 60_000;

function Block({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 font-heading text-base font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{text}</p>;
}

/** Minutes between arrival and leaving, when both are known. */
function minutesOnSite(v: IssueVisit): number | null {
  if (!v.arrivedAt || !v.leftAt) return null;
  const ms = new Date(v.leftAt).getTime() - new Date(v.arrivedAt).getTime();
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / MS_PER_MINUTE) : null;
}

export function WorkTab({
  issue,
  isMos,
  canUseStock,
  onSecondOpinion,
  onRecordResult,
  onMove,
  onUseParts,
}: {
  issue: TicketIssueDetail;
  isMos: boolean;
  canUseStock: boolean;
  onSecondOpinion: () => void;
  onRecordResult: (inspectionId: number) => void;
  onMove: (scheduleId: number) => void;
  onUseParts: () => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const locale = useLocale();
  const inspections = issue.inspections.filter((i) => !i.mistaken).sort((a, b) => b.id - a.id);
  const bookings: IssueSchedule[] = liveSchedules(issue.schedules);
  const terminal = issue.status.value === "closed" || issue.status.value === "cancelled";

  return (
    <div className="space-y-4">
      <Block
        title={t("tickets.work.inspections")}
        icon={ScanSearch}
        action={
          isMos && inspections.length > 0 && !terminal ? (
            <Button variant="outline" size="sm" className="h-8" onClick={onSecondOpinion}>
              <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("tickets.work.addSecondOpinion")}
            </Button>
          ) : null
        }
      >
        {inspections.length === 0 ? <Empty text={t("tickets.work.noInspections")} /> : null}
        {inspections.map((i) => (
          <div key={i.id} className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{i.technician?.name ?? "—"}</span>
              <span className={cn(PILL, INSPECTION_TONE[i.status] ?? INSPECTION_TONE.cancelled)}>
                {vocabText(t, vocabEntry(INSPECTION_STATUSES, i.status))}
              </span>
              <span className="text-xs text-muted-foreground">{formatDayTime(i.scheduledDate, i.scheduledTime)}</span>
              {i.estimatedCost != null ? (
                <span className="ms-auto text-sm font-semibold tabular-nums">{t("tickets.work.quote", { amount: formatMoney(i.estimatedCost) })}</span>
              ) : null}
            </div>
            {i.findings ? (
              <div>
                <p className="text-xs text-muted-foreground">{t("tickets.work.findings")}</p>
                <p className="whitespace-pre-wrap text-sm">{i.findings}</p>
              </div>
            ) : null}
            {i.recommendedRepair ? (
              <div>
                <p className="text-xs text-muted-foreground">{t("tickets.work.recommendedRepair")}</p>
                <p className="whitespace-pre-wrap text-sm">{i.recommendedRepair}</p>
              </div>
            ) : null}
            {i.partsNeeded ? (
              <div>
                <p className="text-xs text-muted-foreground">{t("tickets.work.partsNeeded")}</p>
                <p className="whitespace-pre-wrap text-sm">{i.partsNeeded}</p>
              </div>
            ) : null}
            <AttachmentGallery attachments={i.attachments} />
            {isMos && i.status === "scheduled" && !terminal ? (
              <Button variant="outline" size="sm" className="h-8" onClick={() => onRecordResult(i.id)}>
                <ClipboardList className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {t("workflow.actions.inspection_result")}
              </Button>
            ) : null}
          </div>
        ))}
      </Block>

      <Block title={t("tickets.work.bookings")} icon={CalendarClock}>
        {bookings.length === 0 ? <Empty text={t("tickets.work.noBookings")} /> : null}
        {bookings.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3 text-sm">
            <span className={cn(PILL, "bg-muted text-foreground")}>{t(`tickets.work.kind.${b.kind}`)}</span>
            <span className="font-medium">{b.technician?.name ?? "—"}</span>
            <span className="tabular-nums text-muted-foreground">{formatDayTime(b.date, b.time)}</span>
            {b.expectedCompletionDate ? (
              <span className="text-xs text-muted-foreground">
                {t("tickets.work.expectedBy", { date: formatDay(b.expectedCompletionDate) })}
              </span>
            ) : null}
            {b.delays.filter((d) => !d.mistaken).length ? (
              <span className="text-xs text-muted-foreground">{t("tickets.work.movedTimes", { count: b.delays.filter((d) => !d.mistaken).length })}</span>
            ) : null}
            <span className="ms-auto flex items-center gap-1">
              {b.tripId && isMos ? (
                <Button asChild variant="ghost" size="sm" className="h-8">
                  <Link href={`/${locale}/dashboard/maintenance-trips?trip=${b.tripId}`}>{t("tickets.work.openTrip")}</Link>
                </Button>
              ) : null}
              {isMos && !terminal ? (
                <Button variant="outline" size="sm" className="h-8" onClick={() => onMove(b.id)}>
                  {t("tickets.work.move")}
                </Button>
              ) : null}
            </span>
          </div>
        ))}
      </Block>

      <Block title={t("tickets.work.visits")} icon={MapPin}>
        {issue.visits.length === 0 ? <Empty text={t("tickets.work.noVisits")} /> : null}
        {issue.visits.map((v) => {
          const onSite = minutesOnSite(v);
          return (
            <div key={`${v.tripStopId}-${v.purpose}`} className="space-y-1 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{v.technician?.name ?? "—"}</span>
                <span className={cn(PILL, "bg-muted text-foreground")}>{t(`tickets.work.kind.${v.purpose}`)}</span>
                <span className={cn(PILL, TASK_TONE[v.taskStatus] ?? TASK_TONE.pending)}>
                  {vocabText(t, vocabEntry(VISIT_TASK_STATUSES, v.taskStatus))}
                </span>
                {onSite != null ? (
                  <span className="ms-auto text-xs tabular-nums text-muted-foreground">{t("tickets.work.onSite", { time: formatMinutes(onSite) })}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t("tickets.work.arrived")} {v.arrivedAt ? <LocalTimestamp iso={v.arrivedAt} showZone={false} /> : "—"}
                </span>
                <span>
                  {t("tickets.work.left")} {v.leftAt ? <LocalTimestamp iso={v.leftAt} showZone={false} /> : "—"}
                </span>
              </div>
              {v.notDoneReason ? <p className="text-xs">{t("tickets.work.notDoneReason", { reason: v.notDoneReason })}</p> : null}
            </div>
          );
        })}
      </Block>

      <Block
        title={t("tickets.work.partsUsed")}
        icon={Package}
        action={
          canUseStock && !terminal ? (
            <Button variant="outline" size="sm" className="h-8" onClick={onUseParts}>
              <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("tickets.work.useParts")}
            </Button>
          ) : null
        }
      >
        {issue.stockUsed.length === 0 ? <Empty text={t("tickets.work.noPartsUsed")} /> : null}
        {issue.stockUsed.length ? (
          <ul className="divide-y rounded-md border">
            {issue.stockUsed.map((s) => (
              <li key={s.movementId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="tabular-nums">{formatQuantity(s.quantity)} ×</span>
                <span className="font-medium">{s.part.name}</span>
                {s.storageLocation ? <span className="text-xs text-muted-foreground">{t("tickets.work.from", { location: s.storageLocation.name })}</span> : null}
                {s.serials.length ? <span className="font-mono text-xs text-muted-foreground">{s.serials.join(", ")}</span> : null}
                <span className="ms-auto tabular-nums">{formatMoney(s.value)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Block>
    </div>
  );
}
