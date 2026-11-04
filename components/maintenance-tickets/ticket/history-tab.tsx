"use client";

import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ListChecks, RefreshCw, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageSection } from "@/components/shared/page-section";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import type { TicketIssueDetail } from "@/types/maintenance-system";
import type { IssueStatus } from "@/types/maintenance-tickets.types";
import { IssueHistoryPanel } from "../issue-history-panel";
import { TicketMiniList } from "../ticket-mini-list";

/** Every status before Closed / Cancelled. */
const OPEN_STATUSES: IssueStatus[] = ["new", "in_review", "waiting_on_store", "inspection", "waiting_approval", "scheduled", "work_done"];
const OPEN_PAGE_SIZE = 20;

/**
 * Has this happened here before, and what else is open at this store: the
 * earlier tickets for the same catalog issue at the same store, then the
 * store's other open tickets. Both only exist for a ticket with a store.
 */
export function HistoryTab({ ticketId, issue, storeNumber }: { ticketId: number; issue: TicketIssueDetail; storeNumber: string | null }) {
  const t = useTranslations("maintenanceSystem.tickets.history");

  if (!storeNumber) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <Store className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="max-w-md text-sm text-muted-foreground">{t("noStore")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {issue.issue ? (
        <IssueHistoryPanel storeNumber={storeNumber} issueId={issue.issue.id} issueTitle={issue.title} excludeTicketId={ticketId} />
      ) : (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("otherIssue")}</p>
      )}
      <StoreOpenTickets storeNumber={storeNumber} ticketId={ticketId} />
    </div>
  );
}

function StoreOpenTickets({ storeNumber, ticketId }: { storeNumber: string; ticketId: number }) {
  const t = useTranslations("maintenanceSystem.tickets.history");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";

  const open = useMaintenanceResource(`store-open-tickets:${storeNumber}`, (signal) =>
    maintenanceTicketsService.getTickets(storeNumber, { statuses: OPEN_STATUSES, per_page: OPEN_PAGE_SIZE }, signal),
  );
  const others = (open.data?.data ?? []).filter((ticket) => ticket.id !== ticketId);

  return (
    <PageSection
      rank="tertiary"
      icon={ListChecks}
      title={
        <span>
          {t("openHere")}
          {open.data ? <span className="ms-1.5 normal-case tracking-normal">({others.length})</span> : null}
        </span>
      }
    >
      {open.isLoading && !open.data && (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
      {open.error && !open.data && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{open.error.message}</span>
          <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => void open.refresh()}>
            <RefreshCw className="me-1 h-3 w-3" aria-hidden="true" />
            {t("tryAgain")}
          </Button>
        </div>
      )}
      {open.data && others.length > 0 && (
        <TicketMiniList
          tickets={others}
          dimmed={open.isRefreshing}
          className="rounded-md border bg-background"
          onOpen={(ticket) => router.push(`/${locale}/dashboard/maintenance-tickets/${ticket.id}?store=${encodeURIComponent(storeNumber)}`)}
        />
      )}
      {open.data && others.length === 0 && <p className="text-sm text-muted-foreground">{t("noOtherOpen")}</p>}
    </PageSection>
  );
}
