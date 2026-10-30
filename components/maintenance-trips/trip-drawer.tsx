"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Lock, LockOpen, MoreHorizontal, Phone, RefreshCw, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { formatDateOnlyWithWeekday, formatTimestamp } from "@/lib/utils/date-display";
import { maintenanceTripsService, useTrip } from "@/lib/hooks/use-maintenance-trips";
import {
  formatMinutes,
  jobCounts,
  officeTripState,
  tripLinkUrl,
  tripShareText,
  tripStoreNumbers,
} from "@/lib/maintenance-trips";
import type { Trip, TripEvent, TripSession, TripStop } from "@/types/maintenance-v2";
import { EventDialog } from "./event-dialog";
import { ReasonDialog } from "./reason-dialog";
import { SessionDialog } from "./session-dialog";
import { LinkStatusBadge, TripStateBadge, TripStatusBadge } from "./trip-badges";
import {
  AuditSection,
  FilesSection,
  PurchasesSection,
  Section,
  SessionsSection,
  StopsSection,
  type SessionHandlers,
} from "./trip-drawer-sections";
import { TripLinkActions } from "./trip-link-dialog";

/** What is waiting for a reason / confirmation. */
type Pending =
  | { kind: "close" }
  | { kind: "reopen" }
  | { kind: "tripMistaken" }
  | { kind: "newLink" }
  | { kind: "stopMistaken"; stop: TripStop }
  | { kind: "sessionMistaken"; session: TripSession }
  | { kind: "eventMistaken"; session: TripSession; event: TripEvent };

/**
 * The trip drawer (UI doc §3): link, stops, clocked time, purchases, photos,
 * audits; Add session / Correct (reason required); Close / Reopen.
 * `issuedToken` is a link made in this visit — the only time Copy/Share can
 * work, since the server never shows a token twice.
 */
export function TripDrawer({
  tripId,
  onOpenChange,
  issuedToken,
  onLinkIssued,
  onChanged,
}: {
  tripId: number | null;
  onOpenChange: (open: boolean) => void;
  issuedToken: string | null;
  onLinkIssued: (tripId: number, token: string) => void;
  /** A write changed the trip (refresh the lists). */
  onChanged: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  return (
    <Sheet open={tripId != null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        {tripId != null ? (
          <DrawerBody key={tripId} tripId={tripId} issuedToken={issuedToken} onLinkIssued={onLinkIssued} onChanged={onChanged} />
        ) : (
          <SheetHeader>
            <SheetTitle>{t("vocab.terms.trip.label")}</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerSkeleton() {
  const t = useTranslations("maintenanceV2");
  return (
    <div className="space-y-4 p-4">
      <SheetTitle className="sr-only">{t("vocab.terms.trip.label")}</SheetTitle>
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function DrawerBody({
  tripId,
  issuedToken,
  onLinkIssued,
  onChanged,
}: {
  tripId: number;
  issuedToken: string | null;
  onLinkIssued: (tripId: number, token: string) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const { trip, isLoading, error, refresh, act, pending } = useTrip(tripId);
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [sessionDialog, setSessionDialog] = useState<{ session: TripSession | null } | null>(null);
  const [eventDialog, setEventDialog] = useState<{ session: TripSession; event: TripEvent | null } | null>(null);

  if (isLoading && !trip) return <DrawerSkeleton />;
  if (error && !trip) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <SheetTitle className="sr-only">{t("vocab.terms.trip.label")}</SheetTitle>
        <AlertCircle className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{error.code === "NOT_FOUND" ? t("trips.drawer.notFound") : t("common.loadError")}</p>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw aria-hidden="true" />
          {t("common.retry")}
        </Button>
      </div>
    );
  }
  if (!trip) return null;

  const readOnly = trip.status === "closed" || !!trip.mistaken;

  /** One write that returns the trip; success toast; the caller decides how to show a refusal. */
  async function write(fn: (id: number) => Promise<Trip>, done: string): Promise<void> {
    await act(fn);
    toast.success(done);
    onChanged();
  }

  async function issueLink(): Promise<void> {
    let token: string | null = null;
    await act(async (id) => {
      const result = await maintenanceTripsService.issueNewLink(id);
      token = result.tripLink?.urlToken ?? null;
      return result.trip;
    });
    if (token) onLinkIssued(tripId, token);
    toast.success(t("trips.drawer.linkMade"));
    onChanged();
  }

  /** New link straight from the button (no confirmation needed): a refusal becomes a toast. */
  async function issueLinkOrToast(): Promise<void> {
    try {
      await issueLink();
    } catch (err) {
      toast.error(err instanceof MaintenanceTicketsError ? err.message : t("common.saveError"));
    }
  }

  const handlers: SessionHandlers = {
    onAddSession: () => setSessionDialog({ session: null }),
    onCorrectSession: (session) => setSessionDialog({ session }),
    onSessionMistaken: (session) => setConfirm({ kind: "sessionMistaken", session }),
    onAddEvent: (session) => setEventDialog({ session, event: null }),
    onCorrectEvent: (session, event) => setEventDialog({ session, event }),
    onEventMistaken: (session, event) => setConfirm({ kind: "eventMistaken", session, event }),
  };

  return (
    <>
      <DrawerHeader trip={trip} />
      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
        <LinkSection
          trip={trip}
          issuedToken={issuedToken}
          readOnly={readOnly}
          onNewLink={() => (trip.link.active ? setConfirm({ kind: "newLink" }) : void issueLinkOrToast())}
        />
        <TotalsStrip trip={trip} />
        <StopsSection trip={trip} readOnly={readOnly} onMarkStopMistaken={(stop) => setConfirm({ kind: "stopMistaken", stop })} />
        <SessionsSection trip={trip} readOnly={readOnly} handlers={handlers} />
        <PurchasesSection trip={trip} />
        <FilesSection trip={trip} />
        <AuditSection trip={trip} />
      </div>
      <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 border-t p-3">
        {!trip.mistaken && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="me-auto" aria-label={t("trips.drawer.more")}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm({ kind: "tripMistaken" })}>
                <Trash2 aria-hidden="true" />
                {t("trips.drawer.tripMistaken")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!trip.mistaken && trip.status === "open" && (
          <Button type="button" disabled={pending} onClick={() => setConfirm({ kind: "close" })}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Lock aria-hidden="true" />}
            {t("trips.closeTrip")}
          </Button>
        )}
        {!trip.mistaken && trip.status === "closed" && (
          <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirm({ kind: "reopen" })}>
            <LockOpen aria-hidden="true" />
            {t("trips.reopenTrip")}
          </Button>
        )}
      </SheetFooter>

      <SessionDialog
        open={!!sessionDialog}
        onOpenChange={(open) => !open && setSessionDialog(null)}
        session={sessionDialog?.session ?? null}
        onAdd={(payload) => write((id) => maintenanceTripsService.addSession(id, payload), t("trips.drawer.sessionAdded"))}
        onUpdate={(sessionId, payload) =>
          write((id) => maintenanceTripsService.updateSession(id, sessionId, payload), t("trips.drawer.sessionCorrected"))
        }
      />
      <EventDialog
        open={!!eventDialog}
        onOpenChange={(open) => !open && setEventDialog(null)}
        event={eventDialog?.event ?? null}
        defaultAt={eventDialog?.session.clockIn}
        onAdd={(payload) =>
          write((id) => maintenanceTripsService.addEvent(id, (eventDialog as { session: TripSession }).session.id, payload), t("trips.drawer.eventSaved"))
        }
        onUpdate={(eventId, payload) =>
          write(
            (id) => maintenanceTripsService.updateEvent(id, (eventDialog as { session: TripSession }).session.id, eventId, payload),
            t("trips.drawer.eventSaved"),
          )
        }
      />
      <ConfirmDialogs confirm={confirm} onClose={() => setConfirm(null)} write={write} issueLink={issueLink} />
    </>
  );
}

function DrawerHeader({ trip }: { trip: Trip }) {
  const t = useTranslations("maintenanceV2");
  const state = officeTripState(trip);
  return (
    <SheetHeader className="border-b pe-12">
      <div className="flex flex-wrap items-center gap-2">
        <TripStatusBadge status={trip.status} />
        {trip.status === "open" && <TripStateBadge state={state} />}
        {trip.mistaken && (
          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
            {t("common.mistaken")}
          </span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">#{trip.id}</span>
      </div>
      <SheetTitle className="font-heading text-lg font-semibold">{trip.technician?.name ?? t("vocab.terms.technician.label")}</SheetTitle>
      <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{formatDateOnlyWithWeekday(trip.plannedDate)}</span>
        {trip.technician?.phone && (
          <a href={`tel:${trip.technician.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Phone className="h-3 w-3" aria-hidden="true" />
            <span className="tabular-nums">{trip.technician.phone}</span>
          </a>
        )}
      </SheetDescription>
      {trip.instructions && <p className="rounded-md bg-muted/50 px-2 py-1.5 text-xs whitespace-pre-line">{trip.instructions}</p>}
    </SheetHeader>
  );
}

function LinkSection({
  trip,
  issuedToken,
  readOnly,
  onNewLink,
}: {
  trip: Trip;
  issuedToken: string | null;
  readOnly: boolean;
  onNewLink: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const locale = useLocale();
  const url = issuedToken ? tripLinkUrl(issuedToken, locale) : null;
  const shareText = url
    ? tripShareText({
        link: url,
        plannedDate: trip.plannedDate,
        storeNumbers: tripStoreNumbers(trip),
        locale,
        template: t.raw("trips.shareText") as string,
      })
    : "";
  return (
    <Section
      title={t("trips.drawer.link")}
      action={
        !readOnly && (
          <Button type="button" variant={url ? "outline" : "default"} size="xs" onClick={onNewLink}>
            <RefreshCw aria-hidden="true" />
            {t("trips.newLink")}
          </Button>
        )
      }
    >
      <div className="space-y-2 rounded-md border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <LinkStatusBadge active={trip.link.active} />
          {trip.link.active && trip.link.expiresAt && (
            <span className="text-muted-foreground">{t("trips.drawer.expiresAt", { when: formatTimestamp(trip.link.expiresAt, "MMM d · h:mm a") })}</span>
          )}
          {trip.link.lastUsedAt && (
            <span className="text-muted-foreground">{t("trips.drawer.lastUsed", { when: formatTimestamp(trip.link.lastUsedAt, "MMM d · h:mm a") })}</span>
          )}
        </div>
        {url ? (
          <TripLinkActions url={url} shareText={shareText} />
        ) : (
          !readOnly && <p className="text-xs text-muted-foreground">{t("trips.drawer.linkHidden")}</p>
        )}
      </div>
    </Section>
  );
}

function TotalsStrip({ trip }: { trip: Trip }) {
  const t = useTranslations("maintenanceV2");
  const jobs = jobCounts(trip);
  const cells = [
    { label: t("trips.paidTime"), value: formatMinutes(trip.totals.paidMinutes) },
    { label: t("trips.breaks"), value: formatMinutes(trip.totals.breakMinutes) },
    { label: t("trips.drawer.milesLabel"), value: trip.totals.miles != null ? String(trip.totals.miles) : "—" },
    { label: t("trips.drawer.jobs"), value: t("trips.drawer.jobsValue", { done: jobs.done, total: jobs.total }) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-1 sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="rounded-md border bg-card px-2 py-1.5">
          <dt className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</dt>
          <dd className="text-base font-semibold tabular-nums">{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ConfirmDialogs({
  confirm,
  onClose,
  write,
  issueLink,
}: {
  confirm: Pending | null;
  onClose: () => void;
  write: (fn: (id: number) => Promise<Trip>, done: string) => Promise<void>;
  issueLink: () => Promise<void>;
}) {
  const t = useTranslations("maintenanceV2");
  const open = !!confirm;
  const onOpenChange = (next: boolean) => !next && onClose();
  const kind = confirm?.kind;

  const spec = (() => {
    if (!confirm) return null;
    const svc = maintenanceTripsService;
    const table: Record<Pending["kind"], () => {
      title: string;
      description: string;
      confirmLabel: string;
      destructive?: boolean;
      withReason?: boolean;
      reasonRequired?: boolean;
      run: (reason: string) => Promise<unknown>;
    }> = {
      close: () => ({
        title: t("trips.drawer.closeTitle"),
        description: t("trips.drawer.closeBody"),
        confirmLabel: t("trips.closeTrip"),
        reasonRequired: false,
        run: () => write((id) => svc.closeTrip(id), t("trips.drawer.closed")),
      }),
      reopen: () => ({
        title: t("trips.drawer.reopenTitle"),
        description: t("trips.drawer.reopenBody"),
        confirmLabel: t("trips.reopenTrip"),
        reasonRequired: false,
        run: () => write((id) => svc.reopenTrip(id), t("trips.drawer.reopened")),
      }),
      tripMistaken: () => ({
        title: t("trips.drawer.tripMistaken"),
        description: t("common.markAsMistakeConfirm"),
        confirmLabel: t("common.markAsMistake"),
        destructive: true,
        run: (reason) => write((id) => svc.markTripMistaken(id, { reason }), t("trips.drawer.markedMistake")),
      }),
      newLink: () => ({
        title: t("trips.drawer.newLinkTitle"),
        description: t("trips.drawer.newLinkBody"),
        confirmLabel: t("trips.newLink"),
        withReason: false,
        run: () => issueLink(),
      }),
      stopMistaken: () => ({
        title: t("trips.drawer.removeStop"),
        description: t("common.markAsMistakeConfirm"),
        confirmLabel: t("common.markAsMistake"),
        destructive: true,
        run: (reason) =>
          write((id) => svc.markStopMistaken(id, (confirm as { stop: TripStop }).stop.id, { reason }), t("trips.drawer.markedMistake")),
      }),
      sessionMistaken: () => ({
        title: t("trips.drawer.sessionMistakenTitle"),
        description: t("common.markAsMistakeConfirm"),
        confirmLabel: t("common.markAsMistake"),
        destructive: true,
        run: (reason) =>
          write(
            (id) => svc.markSessionMistaken(id, (confirm as { session: TripSession }).session.id, { reason }),
            t("trips.drawer.markedMistake"),
          ),
      }),
      eventMistaken: () => ({
        title: t("trips.drawer.eventMistakenTitle"),
        description: t("common.markAsMistakeConfirm"),
        confirmLabel: t("common.markAsMistake"),
        destructive: true,
        run: (reason) => {
          const c = confirm as { session: TripSession; event: TripEvent };
          return write((id) => svc.markEventMistaken(id, c.session.id, c.event.id, { reason }), t("trips.drawer.markedMistake"));
        },
      }),
    };
    return table[confirm.kind]();
  })();

  return (
    <ReasonDialog
      key={kind ?? "none"}
      open={open}
      onOpenChange={onOpenChange}
      title={spec?.title ?? ""}
      description={spec?.description}
      confirmLabel={spec?.confirmLabel ?? ""}
      destructive={spec?.destructive}
      withReason={spec?.withReason ?? true}
      reasonRequired={spec?.reasonRequired ?? true}
      onConfirm={(reason) => spec?.run(reason) ?? Promise.resolve()}
    />
  );
}
