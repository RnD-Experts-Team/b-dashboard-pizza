"use client";

import { useTranslations } from "next-intl";
import { Camera, Check, Database, Paperclip, PenLine, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccentBadge, StatusPill } from "@/components/cleaning/cleaning-ui";
import { getValueDisplay } from "@/components/due-keys/due-key-value-format";
import { formatDateOnly, formatWireDateTime } from "@/lib/utils/date-display";
import type { DatedEmployeeDebrief } from "@/lib/manager-hub/employee-debriefs";
import type { MissingEntry } from "@/lib/manager-hub/missing";
import type { DueItem } from "@/types/cleaning.types";
import type { DueKeyItem } from "@/types/due-key.types";
import { HubRow, Meta, TONE_BAR, TONE_TEXT, TypePill, type Tone } from "./hub-ui";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Rows for the three kinds of thing the hub tracks. Every row opens its    */
/*  read-only detail; the trailing quick action goes straight to the panel.  */
/* ────────────────────────────────────────────────────────────────────────── */

/** "Oct 6" for a one-day period, "Oct 6 – Oct 12" otherwise. */
export function formatPeriod(period: [string, string]): string {
  const [from, to] = period;
  if (!from) return "";
  if (!to || from === to) return formatDateOnly(from, "MMM d");
  return `${formatDateOnly(from, "MMM d")} – ${formatDateOnly(to, "MMM d")}`;
}

export function shortTime(iso: string | null | undefined): string {
  return iso ? formatWireDateTime(iso, { dateTimePattern: "MMM d, h:mm a" }) : "";
}

export function clockTime(iso: string | null | undefined): string {
  return iso ? formatWireDateTime(iso, { dateTimePattern: "h:mm a" }) : "";
}

export function debriefTone(item: DueKeyItem, missed: boolean): Tone {
  if (item.filled) return "good";
  return missed ? "bad" : "warn";
}

export function taskTone(item: DueItem, missed: boolean): Tone {
  if (item.status === "done") return "good";
  if (item.status === "overdue" || missed) return "bad";
  return "warn";
}

/** Filled / Missing / Missed badge in the same accent-bar style as StatusPill. */
export function DebriefStatusBadge({ item, missed = false }: { item: DueKeyItem; missed?: boolean }) {
  const t = useTranslations("managerHub.status");
  const tone = debriefTone(item, missed);
  return (
    <AccentBadge
      accent={{ bar: TONE_BAR[tone], text: TONE_TEXT[tone] }}
      label={item.filled ? t("filled") : missed ? t("missed") : t("missing")}
    />
  );
}

export function TaskStatusBadge({ item, missed = false }: { item: DueItem; missed?: boolean }) {
  const t = useTranslations("managerHub.status");
  const tStatus = useTranslations("cleaningChart.status");
  if (missed && item.status !== "done") {
    return <AccentBadge accent={{ bar: TONE_BAR.bad, text: TONE_TEXT.bad }} label={t("missed")} />;
  }
  // StatusPill paints "done" green; the hub keeps done neutral (red/yellow only).
  if (item.status === "done") {
    return <AccentBadge accent={{ bar: TONE_BAR.good, text: TONE_TEXT.good }} label={tStatus("done")} />;
  }
  return <StatusPill status={item.status} />;
}

/* ── Debrief (due key) ───────────────────────────────────────────────────── */

export function DebriefRow({
  item,
  missed = false,
  onOpen,
  onFill,
}: {
  item: DueKeyItem;
  missed?: boolean;
  onOpen: () => void;
  onFill: () => void;
}) {
  const t = useTranslations("managerHub");
  const value = item.filled ? getValueDisplay(item.value).display : null;
  return (
    <HubRow
      tone={debriefTone(item, missed)}
      icon={Database}
      title={item.label}
      openLabel={t("rows.openDetail", { label: item.label })}
      onOpen={onOpen}
      meta={
        <>
          <Meta className="font-mono text-[10px] uppercase">{item.dataType}</Meta>
          {item.tags.slice(0, 2).map((tag) => (
            <Meta key={tag.id} className="rounded bg-muted px-1.5 text-[10px]">
              {tag.name}
            </Meta>
          ))}
          {item.tags.length > 2 && <Meta className="text-[10px]">+{item.tags.length - 2}</Meta>}
          {value != null && (
            <Meta className="max-w-48 font-medium text-foreground">
              {item.value?.correctedFromId != null && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500"
                  title={t("rows.corrected")}
                  aria-label={t("rows.corrected")}
                />
              )}
              <span className="truncate">{value}</span>
            </Meta>
          )}
          {item.value?.userName && (
            <Meta>
              <User className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.value.userName}</span>
            </Meta>
          )}
          {item.value?.updatedAt && <Meta>{shortTime(item.value.updatedAt)}</Meta>}
        </>
      }
      trailing={
        <>
          <span className="hidden sm:inline-flex">
            <DebriefStatusBadge item={item} missed={missed} />
          </span>
          <Button
            size="sm"
            variant={item.filled ? "ghost" : "default"}
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={onFill}
          >
            <PenLine className="h-3.5 w-3.5" />
            <span className={item.filled ? "sr-only sm:not-sr-only" : undefined}>
              {item.filled ? t("rows.edit") : t("rows.fill")}
            </span>
          </Button>
        </>
      }
    />
  );
}

/* ── Cleaning task ───────────────────────────────────────────────────────── */

export function TaskRow({
  item,
  missed = false,
  onOpen,
  onDo,
}: {
  item: DueItem;
  missed?: boolean;
  onOpen: () => void;
  onDo: () => void;
}) {
  const t = useTranslations("managerHub");
  const tFreq = useTranslations("cleaningChart.frequency");
  const done = item.status === "done";
  return (
    <HubRow
      tone={taskTone(item, missed)}
      icon={Sparkles}
      title={item.label}
      openLabel={t("rows.openDetail", { label: item.label })}
      onOpen={onOpen}
      meta={
        <>
          <Meta>{tFreq(item.frequency)}</Meta>
          <Meta className="tabular-nums">{formatPeriod(item.period)}</Meta>
          {item.photoRequired && !done && (
            <Meta>
              <Camera className="h-3 w-3 shrink-0" aria-hidden="true" />
              {t("rows.photoRequired")}
            </Meta>
          )}
          {done && item.doneBy.length > 0 && (
            <Meta>
              <User className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.doneBy.join(", ")}</span>
            </Meta>
          )}
          {done && item.doneAt && <Meta>{shortTime(item.doneAt)}</Meta>}
          {item.hasPhoto && (
            <Meta>
              <Camera className="h-3 w-3 shrink-0" aria-hidden="true" />
              {item.photos.length || 1}
            </Meta>
          )}
        </>
      }
      excerpt={item.note ? `“${item.note}”` : null}
      trailing={
        <>
          <span className="hidden sm:inline-flex">
            <TaskStatusBadge item={item} missed={missed} />
          </span>
          {!done && (
            <Button size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={onDo}>
              <Check className="h-3.5 w-3.5" />
              {t("rows.complete")}
            </Button>
          )}
        </>
      }
    />
  );
}

/* ── Missing entry (overview — either kind) ──────────────────────────────── */

export function MissingRow({
  entry,
  missed = false,
  onOpen,
  onAct,
}: {
  entry: MissingEntry;
  missed?: boolean;
  onOpen: () => void;
  onAct: () => void;
}) {
  return entry.kind === "debrief" ? (
    <DebriefRow item={entry.item} missed={missed} onOpen={onOpen} onFill={onAct} />
  ) : (
    <TaskRow item={entry.item} missed={missed} onOpen={onOpen} onDo={onAct} />
  );
}

/* ── Employee debrief ────────────────────────────────────────────────────── */

export function employeeLabel(entry: DatedEmployeeDebrief["item"], fallback: string): string {
  return entry.employeeName?.trim() || (entry.employeeId != null ? `${fallback} #${entry.employeeId}` : fallback);
}

export function EmployeeDebriefRow({ entry, onOpen }: { entry: DatedEmployeeDebrief; onOpen: () => void }) {
  const t = useTranslations("managerHub");
  const { item } = entry;
  const name = employeeLabel(item, t("employeeDebriefs.employee"));
  const attachments = item.attachments?.length ?? 0;
  return (
    <HubRow
      tone="info"
      icon={PenLine}
      title={name}
      openLabel={t("rows.openDetail", { label: name })}
      onOpen={onOpen}
      meta={
        <>
          {item.type && <TypePill label={item.type.label} />}
          {item.authorName && <Meta>{t("employeeDebriefs.by", { name: item.authorName })}</Meta>}
          {item.createdAt && <Meta className="tabular-nums">{clockTime(item.createdAt)}</Meta>}
          {attachments > 0 && (
            <Meta>
              <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
              {attachments}
            </Meta>
          )}
        </>
      }
      excerpt={item.notes}
    />
  );
}
