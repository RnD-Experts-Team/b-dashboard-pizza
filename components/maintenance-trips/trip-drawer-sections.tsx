"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { History, MoreHorizontal, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AttachmentGallery } from "@/components/maintenance-tickets/attachment-gallery";
import { NotesList } from "@/components/maintenance-tickets/notes-list";
import { PriorityChip } from "@/components/maintenance-tickets/ticket-chips";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/utils/date-display";
import { formatMoney } from "@/lib/maintenance/money";
import {
  PRIORITIES,
  SESSION_SOURCES,
  TRIP_EVENT_KINDS,
  vocabEntry,
  vocabText,
} from "@/lib/maintenance/vocabulary";
import { auditChanges, sessionDurationParts, stopPlace, tripFiles } from "@/lib/maintenance-trips";
import type { Trip, TripAudit, TripEvent, TripSession, TripStop } from "@/types/maintenance-system";
import { StopStatusBadge, TaskStatusBadge } from "./trip-badges";

const DATE_TIME = "MMM d · h:mm a";
const TIME = "h:mm a";

function when(iso: string | null | undefined, pattern = DATE_TIME): string {
  return iso ? formatTimestamp(iso, pattern) : "—";
}

export function Section({
  title,
  action,
  children,
  count,
}: {
  title: string;
  action?: ReactNode;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold">
          {title}
          {count != null && <span className="ms-1.5 text-xs font-normal text-muted-foreground tabular-nums">{count}</span>}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">{text}</p>;
}

function MistakeTag() {
  const t = useTranslations("maintenanceSystem");
  return (
    <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
      {t("common.mistaken")}
    </span>
  );
}

/* ── Stops ───────────────────────────────────────────────────────────────── */

export function StopsSection({
  trip,
  readOnly,
  onMarkStopMistaken,
  onAddStop,
}: {
  trip: Trip;
  readOnly: boolean;
  onMarkStopMistaken: (stop: TripStop) => void;
  onAddStop: () => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const locale = useLocale();
  return (
    <Section
      title={t("trips.drawer.stops")}
      count={trip.stops.filter((s) => !s.mistaken).length}
      action={
        !readOnly && (
          <Button type="button" variant="outline" size="xs" onClick={onAddStop}>
            <Plus aria-hidden="true" />
            {t("trips.addStop.title")}
          </Button>
        )
      }
    >
      {!trip.stops.length ? (
        <Empty text={t("trips.drawer.noStops")} />
      ) : (
        <ol className="space-y-2">
          {trip.stops.map((stop) => {
            const place = stopPlace(stop);
            return (
              <li key={stop.id} className={cn("rounded-md border bg-card p-3 space-y-2", stop.mistaken && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("text-sm font-medium", stop.mistaken && "line-through")}>
                    {place.storeNumber ? t("trips.storeN", { number: place.storeNumber }) : place.other ?? t("common.otherStore")}
                  </span>
                  <StopStatusBadge status={stop.status} />
                  {stop.mistaken && <MistakeTag />}
                  {!readOnly && !stop.mistaken && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="ms-auto"
                      aria-label={t("trips.drawer.removeStop")}
                      onClick={() => onMarkStopMistaken(stop)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
                {(stop.arrivedAt || stop.leftAt) && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("trips.drawer.arrivedLeft", { arrived: when(stop.arrivedAt, TIME), left: when(stop.leftAt, TIME) })}
                    {stop.arrivalOdometer != null && ` · ${t("trips.drawer.odometerAt", { value: String(stop.arrivalOdometer) })}`}
                  </p>
                )}
                {stop.notDoneReason && (
                  <p className="text-xs text-rose-700 dark:text-rose-300">{t("trips.drawer.whyNot", { reason: stop.notDoneReason })}</p>
                )}
                {!!stop.issues.length && (
                  <ul className="space-y-1.5">
                    {stop.issues.map((issue) => {
                      const priority = vocabEntry(PRIORITIES, issue.priority);
                      return (
                        <li key={issue.ticketIssueId} className="rounded border bg-background px-2 py-1.5 text-xs">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/${locale}/dashboard/maintenance-tickets/${issue.ticketId}?issue=${issue.ticketIssueId}`}
                              className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                              #{issue.ticketId} · {issue.title}
                            </Link>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {issue.purpose === "inspection" ? t("trips.purposeInspection") : t("trips.purposeWork")}
                            </span>
                            {priority && <PriorityChip value={priority.value} label={vocabText(t, priority)} prefix="" />}
                            <TaskStatusBadge status={issue.taskStatus} className="ms-auto" />
                          </div>
                          {issue.notDoneReason && (
                            <p className="mt-1 text-rose-700 dark:text-rose-300">{t("trips.drawer.whyNot", { reason: issue.notDoneReason })}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <AttachmentGallery attachments={stop.attachments} />
                {!!stop.notes?.length && <NotesList notes={stop.notes} />}
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

/* ── Sessions ────────────────────────────────────────────────────────────── */

export interface SessionHandlers {
  onAddSession: () => void;
  onCorrectSession: (session: TripSession) => void;
  onSessionMistaken: (session: TripSession) => void;
  onAddEvent: (session: TripSession) => void;
  onCorrectEvent: (session: TripSession, event: TripEvent) => void;
  onEventMistaken: (session: TripSession, event: TripEvent) => void;
}

function DurationRow({ session }: { session: TripSession }) {
  const t = useTranslations("maintenanceSystem");
  const parts = sessionDurationParts(session.durations).filter((p) => p.key === "paid" || p.minutes);
  return (
    <dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {parts.map((p) => (
        <div key={p.key} className="flex items-baseline gap-1">
          <dt className="text-muted-foreground">{t(`trips.durations.${p.key}`)}</dt>
          <dd className={cn("tabular-nums", p.key === "paid" && "font-semibold")}>{p.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function EventRow({
  session,
  event,
  readOnly,
  handlers,
}: {
  session: TripSession;
  event: TripEvent;
  readOnly: boolean;
  handlers: SessionHandlers;
}) {
  const t = useTranslations("maintenanceSystem");
  const entry = vocabEntry(TRIP_EVENT_KINDS, event.kind, event.label);
  return (
    <li className={cn("flex items-center gap-2 text-xs", event.mistaken && "opacity-60")}>
      <span className="w-16 shrink-0 text-muted-foreground tabular-nums">{when(event.at, TIME)}</span>
      <span className={cn("flex-1", event.mistaken && "line-through")}>{vocabText(t, entry)}</span>
      {event.mistaken && <MistakeTag />}
      {!readOnly && !event.mistaken && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={t("trips.drawer.eventActions")}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => handlers.onCorrectEvent(session, event)}>
              <Pencil aria-hidden="true" />
              {t("trips.event.correctTime")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => handlers.onEventMistaken(session, event)}>
              <Trash2 aria-hidden="true" />
              {t("common.markAsMistake")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function SessionCard({
  session,
  readOnly,
  handlers,
}: {
  session: TripSession;
  readOnly: boolean;
  handlers: SessionHandlers;
}) {
  const t = useTranslations("maintenanceSystem");
  const locale = useLocale();
  const source = vocabEntry(SESSION_SOURCES, session.source);
  const editable = !readOnly && !session.mistaken;
  return (
    <li className={cn("rounded-md border bg-card p-3 space-y-2", session.mistaken && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-sm font-medium tabular-nums", session.mistaken && "line-through")}>
          {when(session.clockIn)} → {session.clockOut ? when(session.clockOut, TIME) : t("trips.drawer.stillOn")}
        </span>
        {session.mistaken && <MistakeTag />}
        {session.paid ? (
          <Link
            href={`/${locale}/dashboard/maintenance-payments${session.paymentId ? `?payment=${session.paymentId}` : ""}`}
            className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:underline dark:bg-emerald-500/20 dark:text-emerald-300"
          >
            {t("trips.drawer.paid")}
          </Link>
        ) : (
          !session.mistaken &&
          session.clockOut && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t("trips.drawer.notPaid")}
            </span>
          )
        )}
        {editable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-xs" className="ms-auto" aria-label={t("trips.drawer.sessionActions")}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => handlers.onCorrectSession(session)}>
                <Pencil aria-hidden="true" />
                {t("trips.correct")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handlers.onAddEvent(session)}>
                <Plus aria-hidden="true" />
                {t("trips.event.addTitle")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => handlers.onSessionMistaken(session)}>
                <Trash2 aria-hidden="true" />
                {t("common.markAsMistake")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <DurationRow session={session} />
      <p className="text-[11px] text-muted-foreground">
        {vocabText(t, source)}
        {session.usingCar &&
          ` · ${t("trips.drawer.odometer", {
            from: session.odometerIn != null ? String(session.odometerIn) : "—",
            to: session.odometerOut != null ? String(session.odometerOut) : "—",
          })}`}
        {session.miles != null && ` · ${t("trips.drawer.miles", { miles: String(session.miles) })}`}
      </p>
      {!!session.events.length && (
        <ul className="space-y-1 border-s ps-2">
          {session.events.map((event) => (
            <EventRow key={event.id} session={session} event={event} readOnly={!editable} handlers={handlers} />
          ))}
        </ul>
      )}
      <AttachmentGallery attachments={session.attachments} />
    </li>
  );
}

export function SessionsSection({
  trip,
  readOnly,
  handlers,
}: {
  trip: Trip;
  readOnly: boolean;
  handlers: SessionHandlers;
}) {
  const t = useTranslations("maintenanceSystem");
  return (
    <Section
      title={t("trips.drawer.sessions")}
      count={trip.sessions.filter((s) => !s.mistaken).length}
      action={
        !readOnly && (
          <Button type="button" variant="outline" size="xs" onClick={handlers.onAddSession}>
            <Plus aria-hidden="true" />
            {t("trips.addSession")}
          </Button>
        )
      }
    >
      {!trip.sessions.length ? (
        <Empty text={t("trips.drawer.noSessions")} />
      ) : (
        <ul className="space-y-2">
          {trip.sessions.map((session) => (
            <SessionCard key={session.id} session={session} readOnly={readOnly} handlers={handlers} />
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ── Purchases ───────────────────────────────────────────────────────────── */

export function PurchasesSection({ trip }: { trip: Trip }) {
  const t = useTranslations("maintenanceSystem");
  const locale = useLocale();
  if (!trip.purchases.length) return null;
  return (
    <Section title={t("trips.drawer.purchases")} count={trip.purchases.filter((p) => !p.mistaken).length}>
      <ul className="space-y-2">
        {trip.purchases.map((p) => (
          <li key={p.id} className={cn("rounded-md border bg-card p-3 space-y-1 text-xs", p.mistaken && "opacity-60")}>
            <div className="flex flex-wrap items-center gap-2">
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className={cn("text-sm font-medium", p.mistaken && "line-through")}>{p.description}</span>
              <span className="ms-auto text-sm font-semibold tabular-nums">{formatMoney(p.totalCost)}</span>
            </div>
            <p className="text-muted-foreground">
              {[
                p.supplier?.name,
                p.quantity ? t("trips.drawer.quantity", { qty: String(p.quantity) }) : null,
                p.serialNumber ? t("trips.drawer.serial", { serial: p.serialNumber }) : null,
                when(p.boughtAt),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {p.ticketIssue && (
              <Link
                href={`/${locale}/dashboard/maintenance-tickets/${p.ticketIssue.ticketId}?issue=${p.ticketIssue.id}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                #{p.ticketIssue.ticketId} · {p.ticketIssue.title}
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {p.mistaken ? (
                <MistakeTag />
              ) : (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    p.paid
                      ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      : "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
                  )}
                >
                  {p.paid ? t("trips.drawer.paidBack") : t("trips.drawer.notPaidBack")}
                </span>
              )}
            </div>
            <AttachmentGallery attachments={p.receipts} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ── Photos & notes ──────────────────────────────────────────────────────── */

export function FilesSection({ trip }: { trip: Trip }) {
  const t = useTranslations("maintenanceSystem");
  const files = tripFiles(trip);
  if (!files.length && !trip.notes?.length) return null;
  return (
    <Section title={t("trips.drawer.photosNotes")} count={files.length || undefined}>
      <AttachmentGallery attachments={files} />
      {!!trip.notes?.length && <NotesList notes={trip.notes} />}
    </Section>
  );
}

/* ── Audit list ──────────────────────────────────────────────────────────── */

/**
 * Each dot or underscore in an audit action, replaced by a space:
 * "session.updated" → "session updated", "link_rotated" → "link rotated";
 * "closed" has none and is unchanged.
 * https://regex101.com/?flavor=javascript&regex=%5B._%5D&flags=g&testString=session.updated%0Alink_rotated%0Aclosed
 */
const ACTION_SEPARATORS = /[._]/g;

/** "session.updated" → "Session updated". */
function actionWords(action: string | null | undefined): string {
  if (!action) return "";
  const words = action.replace(ACTION_SEPARATORS, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function AuditRow({ audit }: { audit: TripAudit }) {
  const t = useTranslations("maintenanceSystem");
  const changes = auditChanges(audit);
  return (
    <li className="space-y-1 rounded-md border bg-card px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-medium">{actionWords(audit.action) || t("trips.drawer.change")}</span>
        <span className="text-muted-foreground">
          {[audit.user?.name, when(audit.createdAt)].filter(Boolean).join(" · ")}
        </span>
      </div>
      {audit.reason && <p className="text-muted-foreground">{t("trips.drawer.because", { reason: audit.reason })}</p>}
      {!!changes.length && (
        <ul className="space-y-0.5">
          {changes.map((c) => (
            <li key={c.field} className="break-all tabular-nums">
              <span className="text-muted-foreground">{c.field}: </span>
              <span className="line-through opacity-70">{c.before}</span> → <span>{c.after}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function AuditSection({ trip }: { trip: Trip }) {
  const t = useTranslations("maintenanceSystem");
  const audits = [...(trip.audits ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <Section title={t("trips.drawer.audits")} count={audits.length || undefined}>
      {!audits.length ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          {t("trips.drawer.noAudits")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {audits.map((a) => (
            <AuditRow key={a.id} audit={a} />
          ))}
        </ul>
      )}
    </Section>
  );
}
