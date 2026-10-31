"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Car,
  Check,
  Coffee,
  Link2Off,
  LogIn,
  LogOut,
  MapPin,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  SearchX,
  ShoppingBag,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateOnlyWithWeekday, formatTimestamp } from "@/lib/utils/date-display";
import { tripPortalService, useTripPortal } from "@/lib/hooks/use-trip-portal";
import { openSession, TRIP_BUTTONS, TRIP_STATE_TONE, type TripButton } from "@/lib/maintenance-trips";
import { PRIORITIES, TRIP_STATES, TRIP_STOP_STATUSES, VISIT_TASK_STATUSES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import type { PublicTrip, TripPortalErrorKind, TripState, TripStop } from "@/types/maintenance-system";
import { BigButton, usePortalErrorText } from "./portal-bits";
import {
  AddStoreSheet,
  ArriveSheet,
  ClockInSheet,
  ClockOutSheet,
  IssueDoneSheet,
  NoteSheet,
  ReasonSheet,
  type IssueTarget,
  type PortalRun,
} from "./portal-sheets";
import { PurchaseSheet } from "./purchase-sheet";

const BUTTON_ICONS: Record<string, LucideIcon> = { LogIn, LogOut, Coffee, Car, ShoppingBag };
const STATE_ICONS: Record<TripState, LucideIcon> = {
  off_clock: LogOut,
  on_clock: Check,
  on_break: Coffee,
  travelling: Car,
  parts_run: ShoppingBag,
};

/* ── Full-page states ────────────────────────────────────────────────────── */

const PAGE_STATES: Record<"expired" | "not_found" | "trouble", { icon: LucideIcon; title: string; body: string; retry: boolean }> = {
  expired: { icon: Link2Off, title: "tripPortal.expiredTitle", body: "tripPortal.expired", retry: false },
  not_found: { icon: SearchX, title: "tripPortal.notFoundTitle", body: "tripPortal.notFound", retry: false },
  trouble: { icon: WifiOff, title: "tripPortal.troubleTitle", body: "tripPortal.offline", retry: true },
};

function pageStateOf(kind: TripPortalErrorKind): keyof typeof PAGE_STATES {
  if (kind === "expired" || kind === "not_found") return kind;
  return "trouble";
}

function FullPageMessage({ kind, onRetry, busy }: { kind: TripPortalErrorKind; onRetry: () => void; busy: boolean }) {
  const t = useTranslations("maintenanceSystem");
  const spec = PAGE_STATES[pageStateOf(kind)];
  const Icon = spec.icon;
  const body = kind === "rate_limited" ? "tripPortal.tooFast" : spec.body;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-10" aria-hidden="true" />
      </span>
      <h1 className="font-heading text-2xl font-semibold">{t(spec.title)}</h1>
      <p className="text-lg text-muted-foreground">{t(body)}</p>
      {spec.retry && (
        <BigButton icon={<RefreshCw aria-hidden="true" />} busy={busy} onClick={onRetry}>
          {t("common.retry")}
        </BigButton>
      )}
    </div>
  );
}

function PortalSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-12 w-40 rounded-full" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */

/**
 * The technician's trip page (docs/MAINTENANCE-UI.md §4), no login: the
 * token in the link is the credential. One giant button that follows his
 * state, big secondary ones, his stops and jobs, then "I bought something"
 * and "Add a note/photo". Every action returns the refreshed trip.
 */
export function TripPortal({ token }: { token: string }) {
  const portal = useTripPortal(token);
  const { trip, isLoading, isRefreshing, errorKind, actionErrorKind, refresh } = portal;

  if (isLoading && !trip) return <PortalSkeleton />;
  const fatal = fatalKind(actionErrorKind, trip ? null : errorKind);
  if (fatal) return <FullPageMessage kind={fatal} busy={isRefreshing || isLoading} onRetry={() => void refresh()} />;
  if (!trip) return <FullPageMessage kind="network" busy={isLoading} onRetry={() => void refresh()} />;

  return <PortalBody trip={trip} token={token} run={portal.act} pending={portal.pending} onRefresh={() => void refresh()} refreshing={isRefreshing} />;
}

/** A link that died mid-visit wins; otherwise only a failed first load is full-page. */
function fatalKind(action: TripPortalErrorKind | null, load: TripPortalErrorKind | null): TripPortalErrorKind | null {
  if (action === "expired" || action === "not_found") return action;
  return load;
}

type SheetId = "clockIn" | "clockOut" | "addStore" | "purchase" | "note";

function PortalBody({
  trip,
  token,
  run,
  pending,
  onRefresh,
  refreshing,
}: {
  trip: PublicTrip;
  token: string;
  run: PortalRun;
  pending: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const t = useTranslations("maintenanceSystem");
  const errorText = usePortalErrorText();
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [arriveAt, setArriveAt] = useState<TripStop | null>(null);
  const [doneTarget, setDoneTarget] = useState<IssueTarget | null>(null);
  const [notDone, setNotDone] = useState<{ stop: TripStop; issue: IssueTarget["issue"] | null } | null>(null);
  const [eventBusy, setEventBusy] = useState<string | null>(null);

  const session = openSession(trip);
  const state = trip.state;
  const stateEntry = TRIP_STATES[state];
  const StateIcon = STATE_ICONS[state];
  const buttons = portalButtons(state);
  const stops = trip.stops.filter((s) => !s.mistaken);

  async function press(button: TripButton): Promise<void> {
    if (button.id === "clock_in") {
      setSheet("clockIn");
      return;
    }
    if (button.id === "clock_out") {
      setSheet("clockOut");
      return;
    }
    if (!button.event) return;
    const kind = button.event;
    setEventBusy(button.id);
    try {
      await run((tok) => tripPortalService.addEvent(tok, { kind }));
      toast.success(t(`tripPortal.eventDone.${kind}`));
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setEventBusy(null);
    }
  }

  async function leave(stop: TripStop): Promise<void> {
    try {
      await run((tok) => tripPortalService.leave(tok, stop.id));
      toast.success(t("tripPortal.leftStore"));
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  function arrive(stop: TripStop): void {
    if (session?.usingCar) {
      setArriveAt(stop);
      return;
    }
    void (async () => {
      try {
        await run((tok) => tripPortalService.arrive(tok, stop.id));
        toast.success(t("tripPortal.arrived"));
      } catch (err) {
        toast.error(errorText(err));
      }
    })();
  }

  const PrimaryIcon = BUTTON_ICONS[buttons.primary.icon] ?? LogIn;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold tracking-tight">{trip.technician?.name}</h1>
            <p className="text-lg text-muted-foreground">{formatDateOnlyWithWeekday(trip.plannedDate)}</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            aria-label={t("common.refresh")}
            className="flex size-12 shrink-0 items-center justify-center rounded-full border bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <RefreshCw className={cn("size-5", refreshing && "animate-spin")} aria-hidden="true" />
          </button>
        </div>
        <p
          role="status"
          className={cn("inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-xl font-semibold", TRIP_STATE_TONE[state])}
        >
          <StateIcon className="size-6" aria-hidden="true" />
          {vocabText(t, stateEntry)}
          {session && state !== "off_clock" && (
            <span className="text-base font-normal tabular-nums">· {t("trips.since", { time: formatTimestamp(session.clockIn, "h:mm a") })}</span>
          )}
        </p>
        {trip.clockedInElsewhere && state === "off_clock" && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/15 px-4 py-3 text-base text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            {t("tripPortal.clockedInElsewhere")}
          </p>
        )}
        {trip.instructions && (
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-sm font-medium text-muted-foreground">{t("tripPortal.fromTheOffice")}</p>
            <p className="text-base whitespace-pre-line">{trip.instructions}</p>
          </div>
        )}
      </header>

      <section className="space-y-2" aria-label={t("tripPortal.yourTime")}>
        <BigButton
          size="giant"
          icon={<PrimaryIcon aria-hidden="true" />}
          busy={eventBusy === buttons.primary.id || (pending && !sheet)}
          onClick={() => void press(buttons.primary)}
        >
          {t(buttons.primary.key)}
        </BigButton>
        {buttons.secondary.map((b) => {
          const Icon = BUTTON_ICONS[b.icon] ?? Check;
          return (
            <BigButton
              key={b.id}
              variant="outline"
              icon={<Icon aria-hidden="true" />}
              busy={eventBusy === b.id}
              disabled={!!eventBusy}
              onClick={() => void press(b)}
            >
              {t(b.key)}
            </BigButton>
          );
        })}
      </section>

      <section className="space-y-3" aria-labelledby="portal-stops">
        <h2 id="portal-stops" className="font-heading text-2xl font-semibold">
          {t("tripPortal.yourStops")}
        </h2>
        {!stops.length && (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-base text-muted-foreground">{t("tripPortal.noStops")}</p>
        )}
        {stops.map((stop) => (
          <StopCard
            key={stop.id}
            stop={stop}
            onArrive={() => arrive(stop)}
            onLeave={() => void leave(stop)}
            onDone={(issue) => setDoneTarget({ stop, issue })}
            onNotDone={(issue) => setNotDone({ stop, issue })}
          />
        ))}
        <BigButton variant="outline" icon={<Plus aria-hidden="true" />} onClick={() => setSheet("addStore")}>
          {t("tripPortal.addStore")}
        </BigButton>
      </section>

      <section className="space-y-2 border-t pt-6" aria-label={t("tripPortal.more")}>
        <BigButton variant="secondary" icon={<ShoppingBag aria-hidden="true" />} onClick={() => setSheet("purchase")}>
          {t("tripPortal.boughtSomething")}
        </BigButton>
        <BigButton variant="secondary" icon={<MessageSquarePlus aria-hidden="true" />} onClick={() => setSheet("note")}>
          {t("tripPortal.addNote")}
        </BigButton>
      </section>

      <ClockInSheet open={sheet === "clockIn"} onOpenChange={(o) => setSheet(o ? "clockIn" : null)} run={run} />
      <ClockOutSheet
        open={sheet === "clockOut"}
        onOpenChange={(o) => setSheet(o ? "clockOut" : null)}
        run={run}
        usingCar={!!session?.usingCar}
      />
      <AddStoreSheet open={sheet === "addStore"} onOpenChange={(o) => setSheet(o ? "addStore" : null)} trip={trip} run={run} />
      <PurchaseSheet open={sheet === "purchase"} onOpenChange={(o) => setSheet(o ? "purchase" : null)} trip={trip} token={token} run={run} />
      <NoteSheet open={sheet === "note"} onOpenChange={(o) => setSheet(o ? "note" : null)} trip={trip} run={run} />
      <ArriveSheet stop={arriveAt} onClose={() => setArriveAt(null)} run={run} storeName={arriveAt ? stopName(arriveAt, t) : ""} />
      <IssueDoneSheet target={doneTarget} onClose={() => setDoneTarget(null)} run={run} />
      <ReasonSheet
        open={!!notDone}
        title={t("tripPortal.couldntDoIt")}
        description={notDone ? notDone.issue?.title ?? stopName(notDone.stop, t) : undefined}
        onClose={() => setNotDone(null)}
        run={run}
        onSubmit={(tok, reason) => {
          const target = notDone as { stop: TripStop; issue: IssueTarget["issue"] | null };
          return target.issue
            ? tripPortalService.issueNotDone(tok, target.stop.id, target.issue.ticketIssueId, { reason })
            : tripPortalService.stopNotDone(tok, target.stop.id, { reason });
        }}
      />
    </div>
  );
}

/**
 * The big buttons for his state. Clock in / Clock out is always the giant
 * one; while on a break, driving or getting parts, ending it is the first
 * big secondary button.
 */
function portalButtons(state: TripState): { primary: TripButton; secondary: TripButton[] } {
  return BUTTONS[state];
}

const B = TRIP_BUTTONS;
const BUTTONS: Record<TripState, { primary: TripButton; secondary: TripButton[] }> = {
  off_clock: { primary: B.clock_in, secondary: [] },
  on_clock: { primary: B.clock_out, secondary: [B.break_start, B.travel_start, B.parts_run_start] },
  on_break: { primary: B.clock_out, secondary: [B.break_end] },
  travelling: { primary: B.clock_out, secondary: [B.travel_end] },
  parts_run: { primary: B.clock_out, secondary: [B.parts_run_end] },
};

function stopName(stop: TripStop, t: (key: string, values?: Record<string, string>) => string): string {
  return stop.store ? t("trips.storeN", { number: stop.store.storeNumber }) : stop.otherStore ?? t("common.otherStore");
}

/* ── One stop ────────────────────────────────────────────────────────────── */

const STOP_TONE: Record<TripStop["status"], string> = {
  planned: "bg-muted text-muted-foreground",
  arrived: "bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  done: "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  not_done: "bg-rose-500/15 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
};
const TASK_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  done: "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  not_done: "bg-rose-500/15 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
};

function StopCard({
  stop,
  onArrive,
  onLeave,
  onDone,
  onNotDone,
}: {
  stop: TripStop;
  onArrive: () => void;
  onLeave: () => void;
  onDone: (issue: IssueTarget["issue"]) => void;
  onNotDone: (issue: IssueTarget["issue"] | null) => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const here = stop.status === "arrived" && !stop.leftAt;
  const planned = stop.status === "planned";
  return (
    <article className={cn("space-y-4 rounded-2xl border bg-card p-4", here && "border-primary ring-2 ring-primary/30")}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 font-heading text-2xl font-semibold">
          <MapPin className="size-6 text-muted-foreground" aria-hidden="true" />
          {stopName(stop, t)}
        </h3>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-base font-medium", STOP_TONE[stop.status])}>
          {vocabText(t, TRIP_STOP_STATUSES[stop.status])}
        </span>
      </div>
      {stop.arrivedAt && (
        <p className="text-base text-muted-foreground tabular-nums">
          {t("tripPortal.arrivedAt", { time: formatTimestamp(stop.arrivedAt, "h:mm a") })}
          {stop.leftAt && ` · ${t("tripPortal.leftAt", { time: formatTimestamp(stop.leftAt, "h:mm a") })}`}
        </p>
      )}
      {stop.notDoneReason && <p className="text-base text-rose-700 dark:text-rose-300">{stop.notDoneReason}</p>}

      {planned && (
        <div className="space-y-2">
          <BigButton icon={<MapPin aria-hidden="true" />} onClick={onArrive}>
            {t("tripPortal.imHere")}
          </BigButton>
          <BigButton variant="ghost" icon={<X aria-hidden="true" />} onClick={() => onNotDone(null)}>
            {t("tripPortal.couldntGo")}
          </BigButton>
        </div>
      )}

      {!!stop.issues.length && (
        <ul className="space-y-3">
          {stop.issues.map((issue) => {
            const priority = vocabEntry(PRIORITIES, issue.priority);
            const pending = issue.taskStatus === "pending";
            return (
              <li key={issue.ticketIssueId} className="space-y-3 rounded-xl border bg-background p-3">
                <div className="space-y-1">
                  <p className="text-lg font-medium">{issue.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
                      {issue.purpose === "inspection" ? t("trips.purposeInspection") : t("trips.purposeWork")}
                    </span>
                    {priority && (
                      <span className="rounded-full border px-2.5 py-0.5">
                        {t("common.priority")}: {vocabText(t, priority)}
                      </span>
                    )}
                    <span className={cn("rounded-full px-2.5 py-0.5 font-medium", TASK_TONE[issue.taskStatus] ?? TASK_TONE.pending)}>
                      {vocabText(t, vocabEntry(VISIT_TASK_STATUSES, issue.taskStatus))}
                    </span>
                  </div>
                  {issue.notDoneReason && <p className="text-base text-rose-700 dark:text-rose-300">{issue.notDoneReason}</p>}
                </div>
                {pending && here && (
                  <div className="grid grid-cols-1 gap-2">
                    <BigButton icon={<Check aria-hidden="true" />} onClick={() => onDone(issue)}>
                      {t("tripPortal.done")}
                    </BigButton>
                    <BigButton variant="outline" icon={<X aria-hidden="true" />} onClick={() => onNotDone(issue)}>
                      {t("tripPortal.couldntDoIt")}
                    </BigButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {here && (
        <BigButton variant="outline" icon={<LogOut aria-hidden="true" />} onClick={onLeave}>
          {t("tripPortal.leaving")}
        </BigButton>
      )}
    </article>
  );
}
