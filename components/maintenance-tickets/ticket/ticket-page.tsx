"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentDialog } from "@/components/maintenance-payments/payment-dialog";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import { useTicketPage } from "@/lib/hooks/use-ticket-issue";
import { withPrivateNotes } from "@/lib/maintenance-workflow";
import type { WorkflowNextAction } from "@/types/maintenance-system";
import { ActivityTab } from "./activity-tab";
import { CostsTab } from "./costs-tab";
import { HistoryTab } from "./history-tab";
import { ActionHost, hasDialog, type OpenAction } from "./dialogs/action-host";
import { AddUpdateDialog, UsePartsDialog } from "./dialogs/update-parts-dialogs";
import { OverviewTab } from "./overview-tab";
import { TicketFooter } from "./ticket-footer";
import { NextStepPanel, STEP_TAB, useOnScreen } from "./next-step";
import { IssueSwitcher, TicketHeader } from "./ticket-top";
import { TripLinkDialog } from "./trip-link-dialog";
import { WorkTab } from "./work-tab";

const TABS = ["overview", "work", "costs", "activity", "history"] as const;
type TabId = (typeof TABS)[number];

/** Steps that live in the header's … menu, not in the footer. */
const MENU_STEPS = new Set(["jump", "cancel"]);

const P = "placeholder";
const ISSUE_PATH = `/stores/${P}/tickets/${P}/issues/${P}`;

/** The ticket page's shape while it loads: header, badges, progress, tabs, two cards. */
export function TicketPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full max-w-md" />
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-10 w-full max-w-80" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-44 w-full rounded-xl" />
    </div>
  );
}

export function TicketPage() {
  const t = useTranslations("maintenanceSystem");
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) ?? "en";
  const ticketId = Number(params?.ticketId);
  const storeFromLink = searchParams.get("store");
  const issueParam = Number(searchParams.get("issue")) || null;
  const tabParam = searchParams.get("tab");
  const tab: TabId = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as TabId) : "overview";

  const page = useTicketPage(Number.isFinite(ticketId) ? ticketId : null, storeFromLink, issueParam);
  const { ticket, issues, issue, act, key } = page;
  const storeNumber = ticket?.storeNumber ?? null;

  /* ── Who may do what (pizzasys auth rules) ──────────────────────────── */
  const canAccessRoute = useAuthStore((s) => s.canAccessRoute);
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const ticketStoreId = ticket?.storeId ?? null;
  const allowedAt = useCallback(
    (method: string, path: string) => {
      if (!storeNumber) return false;
      const numericId = overviewStores.find((s) => s.storeId === storeNumber)?.id ?? (ticketStoreId != null ? String(ticketStoreId) : storeNumber);
      return [numericId, storeNumber].some((storeId) => canAccessRoute({ service: "Maintenance", method, path, storeId }));
    },
    [storeNumber, overviewStores, ticketStoreId, canAccessRoute],
  );
  const isMos = allowedAt("POST", `${ISSUE_PATH}/review`);
  const canAnswer = allowedAt("POST", `${ISSUE_PATH}/info-requests/${P}/answer`);
  const canConfirm = allowedAt("POST", `${ISSUE_PATH}/confirmation`);
  const canNote = allowedAt("POST", `${ISSUE_PATH}/notes`);
  const canJump = allowedAt("POST", `${ISSUE_PATH}/jump`);
  const canCancel = allowedAt("POST", `${ISSUE_PATH}/cancel`);
  const readsAllNotes = allowedAt("GET", `/stores/${P}/tickets/${P}/notes/all`);
  const canUseStock = canAccessRoute({ service: "Maintenance", method: "POST", path: "/stock-movements" });
  const canPay = canAccessRoute({ service: "Maintenance", method: "POST", path: "/payments" });

  /* ── MOS-only notes (never on the server's timeline) ────────────────── */
  const privateNotes = useMaintenanceResource(
    readsAllNotes && storeNumber && ticket ? `ticket-notes-all:${storeNumber}:${ticket.id}:${ticket.updatedAt}` : null,
    (signal) => maintenanceTicketsService.getTicketNotes(storeNumber as string, ticketId, true, signal),
  );
  const timeline = useMemo(() => {
    if (!issue) return [];
    const mine = (privateNotes.data ?? []).filter((n) => n.owner.type === "ticket_issue" && n.owner.id === issue.id);
    return withPrivateNotes(issue.timeline, mine);
  }, [issue, privateNotes.data]);
  /** The ticket's own notes: the public ones it ships with, plus MOS-only ones for those who may read them. */
  const ticketNotes = useMemo(() => {
    const shown = ticket?.notes ?? [];
    const known = new Set(shown.map((n) => n.id));
    const hidden = (privateNotes.data ?? []).filter((n) => n.owner.type === "ticket" && !known.has(n.id));
    return [...shown, ...hidden];
  }, [ticket?.notes, privateNotes.data]);

  /* ── URL state ───────────────────────────────────────────────────────── */
  const setParam = useCallback(
    (name: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(name, value);
      else next.delete(name);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  /* ── Dialog state ────────────────────────────────────────────────────── */
  const [openAction, setOpenAction] = useState<OpenAction | null>(null);
  const [addUpdateOpen, setAddUpdateOpen] = useState(false);
  const [usePartsOpen, setUsePartsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [bookedDate, setBookedDate] = useState<string | null>(null);
  const [panelActionsRef, panelActionsOnScreen] = useOnScreen();

  const backHref = `/${locale}/dashboard/maintenance-tickets`;
  const refreshAll = useCallback(() => {
    void page.refresh();
    void privateNotes.refresh();
  }, [page, privateNotes]);


  if (page.isLoading && !page.data) return <TicketPageSkeleton />;

  if (page.error && !page.data) {
    const notFound = page.error.code === "NOT_FOUND" || page.error.code === "FORBIDDEN";
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="max-w-md text-sm text-muted-foreground">{notFound ? t("tickets.page.notFound") : page.error.message}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(backHref)}>
            {t("tickets.page.back")}
          </Button>
          {page.error.retryable || !notFound ? (
            <Button onClick={() => void page.refresh()}>
              <RefreshCw className="me-1.5 h-4 w-4" aria-hidden="true" />
              {t("common.retry")}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!ticket || !issue) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <Info className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("tickets.page.noIssues")}</p>
        <Button variant="outline" onClick={() => router.push(backHref)}>
          {t("tickets.page.back")}
        </Button>
      </div>
    );
  }

  const status = issue.status.value;
  const canRun = Boolean(storeNumber);
  const footerNext: WorkflowNextAction[] = canRun
    ? (issue.workflow?.next ?? []).filter((a) => {
        if (MENU_STEPS.has(a.action) || !hasDialog(a.action)) return false;
        if (isMos) return true;
        return (a.action === "answer" && canAnswer) || (a.action === "confirmation" && canConfirm);
      })
    : [];
  const reviewNow = isMos && (issue.workflow?.next ?? []).some((a) => a.action === "review");
  const jumpAllowed = canRun && canJump && (issue.workflow?.next ?? []).some((a) => a.action === "jump");

  // What each tab holds, so the tab row says where things are before you open them.
  const live = <T extends { mistaken?: boolean }>(rows: T[]) => rows.filter((r) => !r.mistaken).length;
  const tabCount: Partial<Record<TabId, number>> = {
    work: live(issue.inspections) + live(issue.schedules) + issue.visits.length + issue.stockUsed.length,
    costs: issue.payments.length + live(issue.approvals) + live(issue.purchases),
    activity: timeline.length,
  };
  const stepTab = STEP_TAB[status];

  const dialogBase = { issue, run: act, storeNumber, isMos, ticketId, onBooked: setBookedDate, onTicketCancelled: refreshAll };

  return (
    <div className="space-y-6">
      <TicketHeader
        ticket={ticket}
        issue={issue}
        issueCount={issues.length}
        backHref={backHref}
        isRefreshing={page.isRefreshing}
        onRefresh={refreshAll}
        permissions={{ canJump: jumpAllowed, canCancel: canRun && canCancel }}
        onJump={() => setOpenAction({ id: "jump" })}
        onCancelIssue={() => setOpenAction({ id: "cancel" })}
        onCancelTicket={() => setOpenAction({ id: "cancel_ticket" })}
      />

      <IssueSwitcher issues={issues} selectedId={issue.id} onSelect={(id) => setParam("issue", String(id))} />

      <NextStepPanel
        issue={issue}
        next={footerNext}
        isMos={isMos}
        canAnswer={canRun && canAnswer}
        canConfirm={canRun && canConfirm}
        run={act}
        disabled={page.pending}
        actionsRef={panelActionsRef}
        onAction={(a) => setOpenAction({ id: a.action })}
        onShowTab={(id) => setParam("tab", id)}
        onRecordPayment={canPay ? () => setPaymentOpen(true) : undefined}
      />

      {!canRun ? (
        <p className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t("tickets.page.otherStoreReadOnly")}
        </p>
      ) : null}
      {canRun && !isMos ? (
        <p className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t("tickets.page.readOnly")}
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setParam("tab", v === "overview" ? null : v)}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            {TABS.map((id) => (
              <TabsTrigger key={id} value={id} className="gap-1.5">
                {t(`workflow.tabs.${id}`)}
                {tabCount[id] ? <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">{tabCount[id]}</span> : null}
                {stepTab === id && tab !== id ? (
                  <span className="h-2 w-2 rounded-full bg-primary" role="img" aria-label={t("tickets.now.tabHasStep")} />
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            issue={issue}
            canEditDetails={canRun && reviewNow}
            onEditDetails={() => setOpenAction({ id: "review" })}
            ticketNotes={ticketNotes}
            ticketAttachments={ticket.attachments}
          />
        </TabsContent>
        <TabsContent value="work" className="mt-4">
          <WorkTab
            issue={issue}
            isMos={canRun && isMos}
            canUseStock={canRun && canUseStock}
            onSecondOpinion={() => setOpenAction({ id: "second_opinion" })}
            onRecordResult={(inspectionId) => setOpenAction({ id: "inspection_result", inspectionId })}
            onMove={(scheduleId) => setOpenAction({ id: "move", scheduleId })}
            onUseParts={() => setUsePartsOpen(true)}
          />
        </TabsContent>
        <TabsContent value="costs" className="mt-4">
          <CostsTab issue={issue} canPay={canPay} onRecordPayment={() => setPaymentOpen(true)} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab entries={timeline} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab ticketId={ticket.id} issue={issue} storeNumber={storeNumber} />
        </TabsContent>
      </Tabs>

      <ActionHost {...dialogBase} action={openAction} onOpenChange={(open) => !open && setOpenAction(null)} />

      {addUpdateOpen ? <AddUpdateDialog open onOpenChange={setAddUpdateOpen} issueKey={key} onSaved={refreshAll} /> : null}
      {usePartsOpen ? <UsePartsDialog open onOpenChange={setUsePartsOpen} ticketIssueId={issue.id} onSaved={refreshAll} /> : null}

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        prefill={{
          storeId: ticket.storeId ?? undefined,
          otherStore: ticket.storeId == null ? (ticket.otherStore ?? undefined) : undefined,
          ticketIssueIds: [issue.id],
          // Whoever did the work (latest work booking), else whoever looked at it.
          technicianId:
            [...issue.schedules].reverse().find((s) => !s.mistaken && s.kind === "work" && s.technician)?.technician?.id ??
            [...issue.schedules].reverse().find((s) => !s.mistaken && s.technician)?.technician?.id ??
            issue.technicians[0]?.id,
        }}
        onSaved={refreshAll}
      />

      <TripLinkDialog
        link={page.lastTripLink}
        plannedDate={bookedDate}
        storeNumber={storeNumber}
        onClose={page.clearTripLink}
      />


      {/* Last on purpose: the action bar pulls itself into the page's bottom padding. */}
      <TicketFooter
        next={footerNext}
        status={status}
        canAddUpdate={canRun && canNote}
        disabled={page.pending}
        hideSteps={panelActionsOnScreen}
        onAction={(a) => setOpenAction({ id: a.action })}
        onAddUpdate={() => setAddUpdateOpen(true)}
      />
    </div>
  );
}
