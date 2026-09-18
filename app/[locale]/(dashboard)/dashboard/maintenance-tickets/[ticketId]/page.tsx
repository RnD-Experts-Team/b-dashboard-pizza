"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Clock,
  Hash,
  History,
  Paperclip,
  RefreshCw,
  Store as StoreIcon,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection, SectionBreak, SectionGroup } from "@/components/shared/page-section";
import { Skeleton } from "@/components/ui/skeleton";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { useMaintenanceTicketsCatalogStore } from "@/lib/store/maintenance-tickets-catalog.store";
import { useTicketDraft, EMPTY_ISSUE_DRAFT } from "@/lib/hooks/use-ticket-draft";
import { TicketsErrorCard } from "@/components/maintenance-tickets/tickets-error";
import { StatusChip, PriorityChip } from "@/components/maintenance-tickets/ticket-chips";
import { IssueActionGrid } from "@/components/maintenance-tickets/issue-action-grid";
import { IssueActionHost } from "@/components/maintenance-tickets/issue-action-host";
import { IssueRecordList } from "@/components/maintenance-tickets/issue-record-list";
import { EntityNotesAttachments } from "@/components/maintenance-tickets/entity-extras";
import { IssueStatusHistory } from "@/components/maintenance-tickets/issue-status-history";
import { IssueBasketBar } from "@/components/maintenance-tickets/issue-basket-bar";
import { TicketRail } from "@/components/maintenance-tickets/ticket-rail";
import { useIssueBasketStore } from "@/lib/store/issue-basket.store";
import { payeeOf, usePayBasketStore } from "@/lib/store/pay-basket.store";
import { useVisitBasketStore } from "@/lib/store/visit-basket.store";
import { VisitBasketPanel } from "@/components/maintenance-tickets/visit-basket-panel";
import { Checkbox } from "@/components/ui/checkbox";
import { entityPaths } from "@/lib/api/services/maintenance-tickets.service";
import type { IssueActionId } from "@/lib/maintenance-tickets/issue-actions";
import type { CorrectionSeed } from "@/lib/maintenance-tickets/corrections";
import type {
  Ticket,
  TicketIssueAttendance,
  TicketIssue,
  TicketsErrorState,
} from "@/types/maintenance-tickets.types";

/**
 * One ticket, on its own page.
 *
 * It used to be a 75vw sheet, and that was the root of the problem: there was
 * no room, so everything got collapsed, and reaching a form took four nested
 * opens. A page has room. Every issue is open, every action is on screen, and
 * the URL is a link you can send to someone.
 *
 * Reached as /dashboard/maintenance-tickets/{id} with no store in the path,
 * because an "other store" ticket does not have one. The store arrives with the
 * response instead.
 */
export default function TicketPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) ?? "en";
  const ticketId = Number(params?.ticketId);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [issues, setIssues] = useState<TicketIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<TicketsErrorState | null>(null);

  const { technicians, loadCatalog } = useMaintenanceTicketsCatalogStore();

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!Number.isFinite(ticketId)) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Never blank a populated page on refetch -- dim it instead.
      if (mode === "initial") setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const res = await maintenanceTicketsService.getTicketIssuesById(ticketId, ctrl.signal);
        setTicket(res.ticket);
        setIssues(res.data);
        setError(null);
      } catch (err) {
        if (err instanceof MaintenanceTicketsError) {
          if (err.code === "CANCELLED") return;
          setError({ message: err.message, code: err.code, retryable: err.code !== "FORBIDDEN" });
        } else {
          setError({ message: "Something went wrong.", code: "UNKNOWN", retryable: true });
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [ticketId]
  );

  useEffect(() => {
    void load("initial");
    return () => abortRef.current?.abort();
  }, [load]);

  /**
   * The route key every subsequent write binds on.
   *
   * `transformTicket` already resolves this to the store_number when the store
   * relation came back, falling back to the numeric store_id when it did not --
   * which is why globalIndex() upstream loads that relation. Without it this
   * would be a number, and every write from this page would 404.
   */
  const storeNumber = ticket?.storeId ?? "";

  useEffect(() => {
    if (storeNumber) loadCatalog(storeNumber);
  }, [storeNumber, loadCatalog]);

  if (!Number.isFinite(ticketId)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ticket" description="That ticket number does not look right." />
        <BackLink locale={locale} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket ? `Ticket #${ticket.id}` : `Ticket #${ticketId}`}
        description={
          ticket
            ? ticket.otherStore ?? ticket.storeId ?? "Store not recorded"
            : "Loading…"
        }
      >
        <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/dashboard/maintenance-tickets`)}>
          <ArrowLeft className="me-2 h-4 w-4" />
          All tickets
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load("refresh")}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw className={cn("me-2 h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </PageHeader>

      {isLoading && !ticket && <TicketPageSkeleton />}

      {error && !ticket && (
        <TicketsErrorCard
          error={error}
          onRetry={() => void load("initial")}
          onClearError={() => setError(null)}
        />
      )}

      {ticket && (
        <div className="flex gap-6">
          <div
            className={cn(
              "min-w-0 flex-1 space-y-4 transition-opacity",
              isRefreshing && "opacity-60 pointer-events-none"
            )}
          >
            <TicketSummary ticket={ticket} issueCount={issues.length} />

            {/* Each renders nothing until something is put in it. Three
                different collections doing three different jobs, so each has
                its own accent rather than all three looking alike. */}
            <IssueBasketBar technicians={technicians} onChanged={() => void load("refresh")} />
            <VisitBasketPanel technicians={technicians} onLogged={() => void load("refresh")} />
            <PayBasketPeek locale={locale} />

            {issues.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
                <Hash className="h-8 w-8 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">This ticket has no issues on it</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Nothing has been reported against it yet, so there is nothing to work on.
                  </p>
                </div>
              </div>
            )}

            {issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                issues={issues}
                storeId={storeNumber}
                otherStore={ticket.otherStore}
                ticketId={ticket.id}
                technicians={technicians}
                onChanged={() => void load("refresh")}
              />
            ))}
          </div>

          {/* Fetches its own list, so a pasted link shows it too. */}
          <TicketRail locale={locale} activeId={ticket.id} storeId={storeNumber || undefined} />
        </div>
      )}
    </div>
  );
}

/**
 * A one-line reminder that work is waiting on a pay sheet.
 *
 * The pay basket lives on the Daily Pay page; from here it was invisible, so
 * you could mark six things and forget. Not a second control surface -- it
 * says how much is there and links to where it gets finished.
 */
function PayBasketPeek({ locale }: { locale: string }) {
  const items = usePayBasketStore((s) => s.items);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--color-chart-4)]/10 px-3 py-2 text-xs">
      <Wallet className="h-3.5 w-3.5 text-[var(--color-chart-4)]" aria-hidden="true" />
      <span>
        {items.length === 1 ? "1 job is" : `${items.length} jobs are`} waiting on a pay sheet
      </span>
      <Link
        href={`/${locale}/dashboard/daily-pay`}
        className="ms-auto text-[var(--color-chart-4)] hover:underline"
      >
        Go and make it
      </Link>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function TicketSummary({ ticket, issueCount }: { ticket: Ticket; issueCount: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
      <StatusChip value={ticket.status.value} label={ticket.status.label} />
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <StoreIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {ticket.otherStore ?? ticket.storeId ?? "Store not recorded"}
      </span>
      {ticket.type && (
        <span className="text-sm text-muted-foreground">{ticket.type.label}</span>
      )}
      <span className="text-sm text-muted-foreground">
        {issueCount === 1 ? "1 issue" : `${issueCount} issues`}
      </span>
      {ticket.creator && (
        <span className="ms-auto text-xs text-muted-foreground">
          raised by {ticket.creator.name}
        </span>
      )}
    </div>
  );
}

function IssueCard({
  issue,
  issues,
  storeId,
  otherStore,
  ticketId,
  technicians,
  onChanged,
}: {
  issue: TicketIssue;
  issues: TicketIssue[];
  storeId: string;
  otherStore: string | null;
  ticketId: number;
  technicians: ReturnType<typeof useMaintenanceTicketsCatalogStore.getState>["technicians"];
  onChanged: () => void;
}) {
  const [activeAction, setActiveAction] = useState<IssueActionId | null>(null);
  /**
   * Whether "What you can do" is expanded. Controlled, not left to the
   * section's own internal toggle -- see `openAction` below for why.
   */
  const [actionsOpen, setActionsOpen] = useState(true);

  /**
   * Every path that opens a panel goes through here rather than calling
   * `setActiveAction` directly -- one choke point, so a future caller cannot
   * forget it. "What you can do" is collapsible now, and its panel can be
   * triggered from a button that lives in a DIFFERENT section (Correct this,
   * Record what happened next). Setting `activeAction` alone would render the
   * form inside a section that might still be collapsed -- open where the
   * button was, invisible where the form is. Setting both in the same handler
   * keeps them in one render, so the panel's own scroll-into-view (in
   * `ActionPanelSlot`) always finds it already visible.
   *
   * Closing (`action === null`) never force-collapses the section back --
   * that would undo a fold the user chose on purpose.
   */
  function openAction(action: IssueActionId | null) {
    if (action) setActionsOpen(true);
    setActiveAction(action);
  }
  /**
   * The attendance session the panel is adding to.
   *
   * THIS WAS THE BUG. The comment that used to sit here said pressing "Log
   * hours" should always start a NEW session -- so a technician who was
   * already clocked in, with "left to get parts" already on the record, got
   * asked to clock in again the moment you pressed Log hours a second time.
   * "Done" does not close the session upstream; it only closes the panel. The
   * session stays open until a clock_out is actually recorded, and pressing
   * Log hours has to find that and continue it, not bury it under a new one.
   */
  const [liveAttendance, setLiveAttendance] = useState<TicketIssueAttendance | null>(null);

  /**
   * This issue's sessions that are still open -- clocked in, not yet clocked
   * out, not struck. Usually zero or one; more than one means two technicians
   * are on the clock for the same issue at once.
   */
  // Read off the server's cached clock window, not off the events: those two
  // columns exist precisely to answer "is this open", and they are present on
  // every listing whether or not the events relation was loaded with it.
  const openAttendanceEntries = issue.attendanceEntries.filter(
    (e) => !e.mistaken && e.startClock != null && e.endClock == null
  );
  const { getIssueDraft, patchIssueDraft, clearIssueDraftFields } = useTicketDraft(storeId, ticketId);
  const issueDraft = getIssueDraft(issue.id) ?? EMPTY_ISSUE_DRAFT;

  /** "Correct this" seeds the form from the record that was wrong, then opens
   *  it -- so only the field that was actually wrong has to be retyped. */
  const handleCorrect = useCallback(
    (seed: CorrectionSeed) => {
      patchIssueDraft(issue.id, seed.patch);
      openAction(seed.action);
      onChanged();
    },
    // openAction is intentionally excluded: it is a plain function that only
    // ever calls the two stable useState setters, so a render-old reference
    // to it behaves identically to a fresh one -- there is nothing here for a
    // dependency to go stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [issue.id, patchIssueDraft, onChanged]
  );

  const title = issue.issueTitle ?? issue.otherTitle ?? `Issue #${issue.id}`;

  /**
   * The live session, re-read from the freshly loaded issue each render.
   *
   * Holding the object from when the panel opened would leave the stream
   * showing the state before the last event landed -- every press writes, and
   * the refetch is what proves it.
   */
  const liveEntryNow = liveAttendance
    ? (issue.attendanceEntries.find((e) => e.id === liveAttendance.id) ?? liveAttendance)
    : null;

  const basketItems = useIssueBasketStore((s) => s.items);
  const toggleBasket = useIssueBasketStore((s) => s.toggle);
  const inBasket = basketItems.some((i) => i.issueId === issue.id);

  const payItems = usePayBasketStore((s) => s.items);
  const togglePay = usePayBasketStore((s) => s.toggle);
  const markedForPay = payItems.some((i) => i.issueId === issue.id);

  const visitItems = useVisitBasketStore((s) => s.items);
  const toggleVisit = useVisitBasketStore((s) => s.toggle);
  const onThisVisit = visitItems.some((i) => i.issueId === issue.id);

  return (
    /*
      The 2-then-3 inside one issue.

        identity + what's been recorded     <- what this is
        ------------------------------ break
        what you can do + notes + history   <- what you do about it

      Scrolling a ticket with four issues on it, the break tells you which half
      of an issue you are in without reading anything.
    */
    <section className="rounded-xl border bg-card p-4">
      {/* Identity. The card's own head, so it carries the rule rather than
          being a section of its own. */}
      <header className="space-y-2 border-b pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Pick it up to act on it together with issues from other tickets --
              one booking, one visit, one status change across the lot. */}
          <Checkbox
            checked={inBasket}
            onCheckedChange={() =>
              toggleBasket({
                issueId: issue.id,
                ticketId,
                storeId,
                otherStore,
                title,
                storeLabel: storeId,
                ...payeeOf(issue.technicians),
              })
            }
            aria-label={inBasket ? `Take ${title} out of the basket` : `Pick up ${title}`}
          />
          <h2 className="font-heading text-base font-semibold">{title}</h2>
          <StatusChip value={issue.status.value} label={issue.status.label} />
          <PriorityChip value={issue.priority.value} label={issue.priority.label} />
          {issue.assignedPriority && (
            <PriorityChip
              value={issue.assignedPriority.value}
              label={issue.assignedPriority.label}
              prefix="You set:"
            />
          )}

          {/*
            Marks this job for payment without leaving the ticket.

            It does NOT write anything: it drops the issue into the pay basket,
            which the Daily Pay page turns into a sheet you review. Making a pay
            record from a button press on a ticket would be a silent write of
            somebody's money.
          */}
          <button
            type="button"
            onClick={() =>
              togglePay({
                issueId: issue.id,
                ticketId,
                storeId: storeId || null,
                otherStore,
                title,
                ...payeeOf(issue.technicians),
              })
            }
            aria-pressed={markedForPay}
            title="Adds it to the pay basket. Nothing is saved until you make the sheet."
            className={cn(
              "ms-auto inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
              markedForPay
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            {markedForPay ? "Marked for payment" : "Pay for this"}
          </button>

          {/* The same gesture for hours. Deliberately identical in shape to the
              button beside it -- one thing to learn, used twice. */}
          <button
            type="button"
            onClick={() =>
              toggleVisit({
                issueId: issue.id,
                ticketId,
                storeId: storeId || null,
                otherStore,
                title,
              })
            }
            aria-pressed={onThisVisit}
            title="Adds it to the visit. Nothing is saved until you log the hours."
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
              onThisVisit
                ? "border-[var(--color-chart-2)] bg-[var(--color-chart-2)]/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {onThisVisit ? "On this visit" : "Add to visit"}
          </button>
        </div>
        {issue.description && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{issue.description}</p>
        )}
        {issue.technicians.length > 0 && (
          <p className="text-xs text-muted-foreground">
            On it: {issue.technicians.map((t) => t.name).join(", ")}
          </p>
        )}
      </header>

      <SectionGroup className="mt-3">
        {/* Collapsible: a ticket with several issues stacks several of these,
            and the record list is the one you are least likely to need open
            for every issue at once. Starts open, so nothing looks different
            until you actually fold one away. */}
        <PageSection
          rank="secondary"
          icon={ClipboardList}
          title="What has been recorded"
          collapsible
        >
          <IssueRecordList
            issue={issue}
            storeId={storeId}
            ticketId={ticketId}
            onCorrect={handleCorrect}
            onRecordAttendance={(entry) => {
              setLiveAttendance(entry);
              openAction("attendance");
            }}
            onChanged={onChanged}
          />
        </PageSection>
      </SectionGroup>

      <SectionBreak />

      <SectionGroup>
      {/* Collapsible, same as "What has been recorded" -- a ticket with
          several issues means several of these too, and folding away the
          ones you are not acting on right now is worth more than always
          showing all of them. Still starts open: a ticket with one issue
          looks exactly as it always has. */}
      <PageSection
        rank="primary"
        accent={3}
        icon={Wrench}
        title="What you can do"
        collapsible
        open={actionsOpen}
        onOpenChange={setActionsOpen}
      >
        {/*
          THE FORM COMES FIRST, ABOVE THE BUTTONS.

          It used to render underneath the grid, which is ten buttons and two
          headings tall -- so pressing one put the thing you were about to fill
          in most of a screen below the thing you just pressed, and opening it
          from the Hours section put it further still. Whatever is open belongs
          at the top of this section, where the section header already is.
        */}
        <ActionPanelSlot activeAction={activeAction}>
          <IssueActionHost
            action={activeAction}
            issue={issue}
            storeId={storeId}
            ticketId={ticketId}
            technicians={technicians}
            ticketIssues={issues}
            storeNumber={storeId || null}
            issueDraft={issueDraft}
            onPatchDraft={(patch) => patchIssueDraft(issue.id, patch)}
            onClearDraftFields={(keys) => clearIssueDraftFields(issue.id, keys)}
            liveAttendance={liveEntryNow}
            attendanceOpenSessions={openAttendanceEntries}
            onClose={() => {
              setLiveAttendance(null);
              setActiveAction(null);
            }}
            onSuccess={onChanged}
          />
        </ActionPanelSlot>

        <IssueActionGrid
          issue={issue}
          activeAction={activeAction}
          onSelect={(action) => {
            // A fresh press of "Log hours" continues whatever is already
            // open, when that is unambiguous -- one open session is by far
            // the common case, and re-asking "who" would just discard the
            // "left to get parts" that is already sitting on the record.
            // Two technicians on the clock at once is genuinely ambiguous;
            // the panel itself offers those as a pick rather than guessing.
            setLiveAttendance(
              action === "attendance" && openAttendanceEntries.length === 1
                ? openAttendanceEntries[0]
                : null
            );
            openAction(action);
          }}
        />
      </PageSection>

      <PageSection rank="secondary" icon={Paperclip} title="Notes and files">
        <EntityNotesAttachments
          entityPath={entityPaths.ticketIssue(storeId, ticketId, issue.id)}
          notes={issue.notes}
          attachments={issue.attachments}
          onSuccess={onChanged}
          allowNoteType={false}
        />
      </PageSection>

      {/* TERTIARY: reference, not work. Borderless and tinted so it reads as
          the floor of the card rather than another thing to act on. */}
      <PageSection rank="tertiary" icon={History}>
        <IssueStatusHistory changes={issue.statusChanges} />
      </PageSection>
      </SectionGroup>
    </section>
  );
}

/**
 * Where whatever action is open gets rendered.
 *
 * Two jobs, both about not losing the user:
 *
 *  1. It sits ABOVE the button grid, so the form is adjacent to the section
 *     heading rather than below ten buttons.
 *  2. It scrolls itself into view when the action changes -- `block: "nearest"`,
 *     so a panel already on screen does not jump. Opening one from the Hours
 *     section is a short deliberate move to a marked panel, not a hunt.
 *
 * The accent bar is the same one the section header carries, so the panel reads
 * as part of what you just pressed rather than as something that appeared.
 */
function ActionPanelSlot({
  activeAction,
  children,
}: {
  activeAction: IssueActionId | null;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeAction) return;
    // rAF, not a bare call: the panel mounts in this same commit and has no
    // height yet when the effect runs, so scrolling now would aim at a
    // zero-height box and land short.
    const frame = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeAction]);

  if (!activeAction) return null;

  return (
    <div
      ref={ref}
      className="mb-4 scroll-mt-4 rounded-lg border border-s-2 border-s-primary bg-background p-3"
    >
      {children}
    </div>
  );
}

function BackLink({ locale }: { locale: string }) {
  return (
    <Link
      href={`/${locale}/dashboard/maintenance-tickets`}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to all tickets
    </Link>
  );
}

function TicketPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
