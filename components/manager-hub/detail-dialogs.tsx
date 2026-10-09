"use client";

/* eslint-disable @next/next/no-img-element -- attachment previews come from the
   upstream storage origin; next/image remote config is unnecessary for them. */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  History,
  PenLine,
  Undo2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DialogShell } from "@/components/workbooks/dialog-shell";
import { PhotoThumbs } from "@/components/cleaning/cleaning-ui";
import { getValueDisplay } from "@/components/due-keys/due-key-value-format";
import { DueKeyHistoryDialog } from "@/components/due-keys/due-key-history-dialog";
import { cn } from "@/lib/utils";
import { formatDateOnlyWithWeekday } from "@/lib/utils/date-display";
import type { DatedEmployeeDebrief } from "@/lib/manager-hub/employee-debriefs";
import type { DueItem } from "@/types/cleaning.types";
import type { DueKeyItem } from "@/types/due-key.types";
import type { DebriefAttachment } from "@/types/employee-debrief.types";
import { TypePill } from "./hub-ui";
import { DebriefStatusBadge, TaskStatusBadge, employeeLabel, formatPeriod, shortTime } from "./rows";
import type { HubActions } from "./use-hub-actions";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Read-only detail dialogs — fixed height, pinned header/footer, only the  */
/*  body scrolls (DialogShell). The footer carries the way to act: the       */
/*  floating panel first, the full page second.                              */
/*                                                                            */
/*  Handing off: the dialog closes BEFORE the panel opens, and skips Radix's */
/*  focus hand-back — otherwise the returning focus lands outside the just-  */
/*  opened popover and dismisses it.                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export type HubDetail =
  | { kind: "debrief"; item: DueKeyItem; date: string; missed: boolean }
  | { kind: "cleaning"; item: DueItem; date: string; missed: boolean }
  | { kind: "employee"; entry: DatedEmployeeDebrief };

/** Long enough for the dialog's 200ms exit animation to finish. */
const HANDOFF_DELAY_MS = 220;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

function Fields({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-border/60">{children}</dl>;
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
      {children}
    </h3>
  );
}

function TextBlock({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <div
      className={cn(
        "max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 text-sm",
        mono && "font-mono text-xs",
      )}
    >
      {children}
    </div>
  );
}

function formatBytes(size: number | null | undefined): string {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function Attachments({
  items,
}: {
  items: { id: number; url: string | null | undefined; name: string | null | undefined; mime: string | null | undefined; size?: number | null }[];
}) {
  if (items.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((a) => {
        const isImage = !!a.mime?.startsWith("image/") && !!a.url;
        const body = (
          <>
            {isImage ? (
              <img src={a.url as string} alt={a.name ?? ""} className="h-10 w-10 shrink-0 rounded object-cover" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{a.name || `#${a.id}`}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {[a.mime, formatBytes(a.size)].filter(Boolean).join(" · ")}
              </span>
            </span>
            {a.url && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
          </>
        );
        return (
          <li key={a.id}>
            {a.url ? (
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border p-2 transition-colors hover:bg-muted/50"
              >
                {body}
              </a>
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg border p-2">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function debriefAttachments(list: DebriefAttachment[] | undefined) {
  return (list ?? []).map((a) => ({
    id: a.id,
    url: a.attachmentUrl,
    name: a.originalName,
    mime: a.mimeType,
    size: a.size,
  }));
}

/* ── Bodies ──────────────────────────────────────────────────────────────── */

function DebriefBody({ item, date, missed }: { item: DueKeyItem; date: string; missed: boolean }) {
  const t = useTranslations("managerHub.detail");
  const v = item.value;
  const value = getValueDisplay(v);
  return (
    <div className="space-y-1">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DebriefStatusBadge item={item} missed={missed} />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {formatDateOnlyWithWeekday(date)}
        </span>
      </div>

      <BlockTitle>{t("value")}</BlockTitle>
      {item.filled && v ? (
        <TextBlock mono={item.dataType === "json"}>{value.display}</TextBlock>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {missed ? t("noValueMissed") : t("noValue")}
        </p>
      )}

      <BlockTitle>{t("details")}</BlockTitle>
      <Fields>
        <Field label={t("type")}>
          <span className="font-mono text-xs uppercase">{item.dataType}</span>
        </Field>
        {item.tags.length > 0 && (
          <Field label={t("tags")}>
            <span className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span key={tag.id} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {tag.name}
                </span>
              ))}
            </span>
          </Field>
        )}
        {v?.userName && <Field label={t("filledBy")}>{v.userName}</Field>}
        {v?.createdAt && <Field label={t("filledAt")}>{shortTime(v.createdAt)}</Field>}
        {v?.updatedAt && v.updatedAt !== v.createdAt && (
          <Field label={t("updatedAt")}>{shortTime(v.updatedAt)}</Field>
        )}
        {v?.correctedFromId != null && (
          <Field label={t("corrected")}>
            <span className="inline-flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              {t("correctedBody")}
            </span>
          </Field>
        )}
      </Fields>

      {v?.note && (
        <>
          <BlockTitle>{t("note")}</BlockTitle>
          <TextBlock>{v.note}</TextBlock>
        </>
      )}

      {v && v.attachments.length > 0 && (
        <>
          <BlockTitle>{t("attachments", { count: v.attachments.length })}</BlockTitle>
          <Attachments
            items={v.attachments.map((a) => ({
              id: a.id,
              url: a.attachmentUrl,
              name: a.originalName,
              mime: a.mimeType,
              size: a.size,
            }))}
          />
        </>
      )}
    </div>
  );
}

function TaskBody({ item, date, missed }: { item: DueItem; date: string; missed: boolean }) {
  const t = useTranslations("managerHub.detail");
  const tFreq = useTranslations("cleaningChart.frequency");
  return (
    <div className="space-y-1">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TaskStatusBadge item={item} missed={missed} />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {formatDateOnlyWithWeekday(date)}
        </span>
      </div>

      {item.description && (
        <>
          <BlockTitle>{t("description")}</BlockTitle>
          <TextBlock>{item.description}</TextBlock>
        </>
      )}

      <BlockTitle>{t("details")}</BlockTitle>
      <Fields>
        <Field label={t("frequency")}>{tFreq(item.frequency)}</Field>
        <Field label={t("period")}>
          <span className="tabular-nums">{formatPeriod(item.period)}</span>
        </Field>
        <Field label={t("photo")}>{item.photoRequired ? t("photoRequired") : t("photoOptional")}</Field>
        {item.doneBy.length > 0 && <Field label={t("doneBy")}>{item.doneBy.join(", ")}</Field>}
        {item.doneAt && <Field label={t("doneAt")}>{shortTime(item.doneAt)}</Field>}
        <Field label={t("completions")}>
          <span className="tabular-nums">{item.completionsCount}</span>
        </Field>
      </Fields>

      {item.note && (
        <>
          <BlockTitle>{t("note")}</BlockTitle>
          <TextBlock>{item.note}</TextBlock>
        </>
      )}

      {item.photos.length > 0 && (
        <>
          <BlockTitle>{t("photos", { count: item.photos.length })}</BlockTitle>
          <PhotoThumbs photos={item.photos} />
        </>
      )}
    </div>
  );
}

function EmployeeBody({ entry }: { entry: DatedEmployeeDebrief }) {
  const t = useTranslations("managerHub.detail");
  const { item } = entry;
  const attachments = debriefAttachments(item.attachments);
  return (
    <div className="space-y-1">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {item.type ? (
          <TypePill label={item.type.label} />
        ) : (
          <span className="text-xs text-muted-foreground">{t("noType")}</span>
        )}
        {entry.day && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDateOnlyWithWeekday(entry.day)}
          </span>
        )}
      </div>

      <BlockTitle>{t("notes")}</BlockTitle>
      {item.notes ? (
        <TextBlock>{item.notes}</TextBlock>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {t("noNotes")}
        </p>
      )}

      <BlockTitle>{t("details")}</BlockTitle>
      <Fields>
        <Field label={t("employee")}>{employeeLabel(item, t("employee"))}</Field>
        {item.authorName && <Field label={t("author")}>{item.authorName}</Field>}
        {item.createdAt && <Field label={t("createdAt")}>{shortTime(item.createdAt)}</Field>}
        {item.updatedAt && item.updatedAt !== item.createdAt && (
          <Field label={t("updatedAt")}>{shortTime(item.updatedAt)}</Field>
        )}
      </Fields>

      {attachments.length > 0 && (
        <>
          <BlockTitle>{t("attachments", { count: attachments.length })}</BlockTitle>
          <Attachments items={attachments} />
        </>
      )}
    </div>
  );
}

/* ── Dialog ──────────────────────────────────────────────────────────────── */

export function HubDetailDialog({
  detail,
  onClose,
  actions,
  storeCode,
}: {
  detail: HubDetail | null;
  onClose: () => void;
  actions: HubActions;
  storeCode: string | null;
}) {
  const t = useTranslations("managerHub.detail");
  const tKind = useTranslations("managerHub.kinds");
  // Keep the last detail while the dialog animates closed.
  const [shown, setShown] = useState<HubDetail | null>(detail);
  if (detail && detail !== shown) setShown(detail);
  const [historyOpen, setHistoryOpen] = useState(false);
  const handingOff = useRef(false);

  const handOff = (run: () => void) => {
    handingOff.current = true;
    onClose();
    setTimeout(run, HANDOFF_DELAY_MS);
  };

  if (!shown) return null;

  let title: string;
  let description: string;
  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (shown.kind === "debrief") {
    const { item, date } = shown;
    title = item.label;
    description = tKind("debrief");
    body = <DebriefBody item={item} date={date} missed={shown.missed} />;
    footer = (
      <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {storeCode && item.filled ? (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setHistoryOpen(true)}>
            <History className="h-3.5 w-3.5" />
            {t("viewHistory")}
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => handOff(() => actions.openDebriefs(date))}>
            {t("openDayInPanel")}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => handOff(() => actions.fillDebrief(item, date))}>
            <PenLine className="h-3.5 w-3.5" />
            {item.filled ? t("editInPanel") : t("fillInPanel")}
          </Button>
        </div>
      </div>
    );
  } else if (shown.kind === "cleaning") {
    const { item, date } = shown;
    const done = item.status === "done";
    title = item.label;
    description = tKind("cleaning");
    body = <TaskBody item={item} date={date} missed={shown.missed} />;
    footer = (
      <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => handOff(() => actions.goCleaningChart(date, item.taskId))}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t("openInCleaningChart")}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => handOff(() => actions.doTask(item, date))}>
          {done ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          {done ? t("undoInPanel") : t("completeInPanel")}
        </Button>
      </div>
    );
  } else {
    const { entry } = shown;
    title = employeeLabel(entry.item, t("employee"));
    description = tKind("employee");
    body = <EmployeeBody entry={entry} />;
    footer = (
      <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => handOff(() => actions.goEmployeeHistory(entry.item.employeeId))}
        >
          <UserRound className="h-3.5 w-3.5" />
          {t("employeeHistory")}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => handOff(() => actions.addEmployeeDebrief())}>
          <PenLine className="h-3.5 w-3.5" />
          {t("addEmployeeDebrief")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Dialog open={detail != null} onOpenChange={(o) => !o && onClose()}>
        <DialogShell
          title={title}
          description={description}
          footer={footer}
          onCloseAutoFocus={(e) => {
            if (handingOff.current) {
              e.preventDefault();
              handingOff.current = false;
            }
          }}
        >
          <div key={shown.kind === "employee" ? `e-${shown.entry.item.id}` : `${shown.kind}-${shown.date}-${title}`} className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
            {body}
          </div>
        </DialogShell>
      </Dialog>

      {shown.kind === "debrief" && storeCode && (
        <DueKeyHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          storeId={storeCode}
          keyId={shown.item.keyId}
          date={shown.date}
          label={shown.item.label}
        />
      )}
    </>
  );
}
