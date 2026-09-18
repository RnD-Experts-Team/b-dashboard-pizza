"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Store as StoreIcon, Hash, ChevronRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { useMaintenanceTicketsCatalogStore } from "@/lib/store/maintenance-tickets-catalog.store";
import { useMaintenanceTicketsStore } from "@/lib/store/maintenance-tickets.store";
import { useTicketDraft, EMPTY_ISSUE_DRAFT } from "@/lib/hooks/use-ticket-draft";
import { TicketsErrorCard } from "@/components/maintenance-tickets/tickets-error";
import { StatusChip, PriorityChip } from "@/components/maintenance-tickets/ticket-chips";
import { IssueActionGrid } from "@/components/maintenance-tickets/issue-action-grid";
import { IssueActionHost } from "@/components/maintenance-tickets/issue-action-host";
import { IssueRecordList } from "@/components/maintenance-tickets/issue-record-list";
import { EntityNotesAttachments } from "@/components/maintenance-tickets/entity-extras";
import { IssueStatusHistory } from "@/components/maintenance-tickets/issue-status-history";
import { IssueBasketBar } from "@/components/maintenance-tickets/issue-basket-bar";
import { useIssueBasketStore } from "@/lib/store/issue-basket.store";
import { usePayBasketStore } from "@/lib/store/pay-basket.store";
import { Checkbox } from "@/components/ui/checkbox";
import { entityPaths } from "@/lib/api/services/maintenance-tickets.service";
import type { IssueActionId } from "@/lib/maintenance-tickets/issue-actions";
import type { CorrectionSeed } from "@/lib/maintenance-tickets/corrections";
import type {
  Ticket,
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
  /** The surrounding tickets, when the user arrived from the list. Populated
   *  only in that case -- fetching the whole list to draw a rail on a page
   *  reached by link would cost a request nobody asked for. */
  const listData = useMaintenanceTicketsStore((s) => s.data);

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

  const railTickets = useMemo(() => listData?.data ?? [], [listData]);

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

            {/* Renders nothing until something is picked up. */}
            <IssueBasketBar technicians={technicians} onChanged={() => void load("refresh")} />

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

          {railTickets.length > 1 && (
            <TicketRail locale={locale} tickets={railTickets} activeId={ticket.id} />
          )}
        </div>
      )}
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
  const { getIssueDraft, patchIssueDraft, clearIssueDraftFields } = useTicketDraft(storeId, ticketId);
  const issueDraft = getIssueDraft(issue.id) ?? EMPTY_ISSUE_DRAFT;

  /** "Correct this" seeds the form from the record that was wrong, then opens
   *  it -- so only the field that was actually wrong has to be retyped. */
  const handleCorrect = useCallback(
    (seed: CorrectionSeed) => {
      patchIssueDraft(issue.id, seed.patch);
      setActiveAction(seed.action);
      onChanged();
    },
    [issue.id, patchIssueDraft, onChanged]
  );

  const title = issue.issueTitle ?? issue.otherTitle ?? `Issue #${issue.id}`;

  const basketItems = useIssueBasketStore((s) => s.items);
  const toggleBasket = useIssueBasketStore((s) => s.toggle);
  const inBasket = basketItems.some((i) => i.issueId === issue.id);

  const payItems = usePayBasketStore((s) => s.items);
  const togglePay = usePayBasketStore((s) => s.toggle);
  const markedForPay = payItems.some((i) => i.issueId === issue.id);
  /** The payee, when the issue already knows. One technician is the common
   *  case; with several we leave it blank rather than guess which one is owed. */
  const soleTechnician = issue.technicians.length === 1 ? issue.technicians[0] : null;

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <header className="space-y-2">
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
                title,
                storeLabel: storeId,
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
                technicianId: soleTechnician?.id ?? null,
                technicianName: soleTechnician?.name ?? null,
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

      <IssueRecordList
        issue={issue}
        storeId={storeId}
        ticketId={ticketId}
        onCorrect={handleCorrect}
        onChanged={onChanged}
      />

      {/* Never collapsed. Every action on screen, always. */}
      <IssueActionGrid issue={issue} activeAction={activeAction} onSelect={setActiveAction} />

      {activeAction && (
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
          onClose={() => setActiveAction(null)}
          onSuccess={onChanged}
        />
      )}

      <EntityNotesAttachments
        entityPath={entityPaths.ticketIssue(storeId, ticketId, issue.id)}
        notes={issue.notes}
        attachments={issue.attachments}
        onSuccess={onChanged}
        allowNoteType={false}
      />

      <IssueStatusHistory changes={issue.statusChanges} />
    </section>
  );
}

function TicketRail({
  locale,
  tickets,
  activeId,
}: {
  locale: string;
  tickets: Ticket[];
  activeId: number;
}) {
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Nearby tickets
      </p>
      <nav className="space-y-1">
        {tickets.map((t) => (
          <Link
            key={t.id}
            href={`/${locale}/dashboard/maintenance-tickets/${t.id}`}
            className={cn(
              "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors",
              t.id === activeId
                ? "border-primary bg-primary/10 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <span className="tabular-nums">#{t.id}</span>
            <span className="truncate">
              {t.otherStore ?? t.storeId ?? "—"}
            </span>
            {t.id !== activeId && <ChevronRight className="ms-auto h-3 w-3 shrink-0" />}
          </Link>
        ))}
      </nav>
    </aside>
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
