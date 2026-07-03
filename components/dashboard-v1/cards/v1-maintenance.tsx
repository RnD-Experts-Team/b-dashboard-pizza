"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClipboardList, ExternalLink, Loader2, Plus } from "lucide-react";

import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { Ticket, CatalogIssue, CatalogTechnician } from "@/types/maintenance-tickets.types";

import { V1Card } from "@/components/dashboard-v1/v1-card";
import {
  V1Empty,
  V1_TBL,
  V1_TH,
  V1_TD,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";
import { fmtDate, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreateTicketDialog } from "@/components/maintenance-tickets/create-ticket-dialog";
import { TicketDetailSheet } from "@/components/maintenance-tickets/ticket-detail-sheet";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1MaintenanceCard — Dashboard V1, category "quality", period "D".
 * ────────────────────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/30",
  in_progress:
    "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/30",
  complete:
    "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/30",
  deferred:
    "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/30",
  cancelled:
    "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30",
};

function StatusBadge({ label, value }: { label: string; value: string }) {
  return (
    <Badge
      className={cn(
        "whitespace-nowrap px-1.5 py-0 text-[9px] font-medium",
        STATUS_STYLES[value] ?? "bg-muted text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </Badge>
  );
}

export function V1MaintenanceCard({
  span = 1,
  className,
}: {
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const { selectedStore } = useSelectedStoreStore();
  const storeId = selectedStore?.storeId ?? null;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [technicians, setTechnicians] = useState<CatalogTechnician[]>([]);
  const techLoadedRef = useRef(false);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [catalogIssues, setCatalogIssues] = useState<CatalogIssue[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!storeId) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsLoading(true);
    setError(null);
    try {
      const res = await maintenanceTicketsService.getTickets(
        storeId,
        {} as Parameters<typeof maintenanceTicketsService.getTickets>[1],
        ctrl.signal,
      );
      if (!ctrl.signal.aborted) {
        setTickets(res.data);
      }
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(
        err instanceof MaintenanceTicketsError
          ? err.message
          : "Failed to load tickets.",
      );
    } finally {
      if (!ctrl.signal.aborted) setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchTickets();
    return () => abortRef.current?.abort();
  }, [fetchTickets]);

  async function handleRowClick(ticket: Ticket) {
    setSelectedTicketId(ticket.id);
    setSheetOpen(true);
    if (!techLoadedRef.current) {
      techLoadedRef.current = true;
      try {
        const techs = await maintenanceTicketsService.getCatalogTechnicians();
        setTechnicians(techs);
      } catch {
        // Sheet works without technicians for read-only viewing
      }
    }
  }

  // Load issues before opening so the combobox is already populated.
  async function handleOpenCreate() {
    if (catalogIssues.length === 0 && !catalogLoading) {
      setCatalogLoading(true);
      try {
        const issues = await maintenanceTicketsService.getCatalogIssues(undefined, storeId ?? undefined);
        setCatalogIssues(issues);
      } catch {
        // Dialog still usable — user can create new issues inline
      } finally {
        setCatalogLoading(false);
      }
    }
    setCreateOpen(true);
  }

  const pageLink = (
    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" asChild>
      <Link href={`/${locale}/dashboard/maintenance-tickets`}>
        <ExternalLink className="h-3 w-3" />
      </Link>
    </Button>
  );

  const headerActions = (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        className="h-5 gap-0.5 px-1.5 text-[9px]"
        onClick={handleOpenCreate}
        disabled={catalogLoading}
        aria-label="Create ticket"
      >
        {catalogLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
        New
      </Button>
      {pageLink}
    </div>
  );

  // Loading
  if (isLoading && tickets.length === 0) {
    return <WbrCardSkeleton className={className} />;
  }

  // No store selected
  if (!storeId) {
    return (
      <V1Card title="Recent Tickets" category="quality" period="D" span={span} className={className}>
        <V1Empty>No store selected.</V1Empty>
      </V1Card>
    );
  }

  // Error or empty
  if ((error && tickets.length === 0) || (!isLoading && tickets.length === 0)) {
    return (
      <>
        <V1Card title="Recent Tickets" category="quality" period="D" span={span} className={className} headerControl={headerActions}>
          <V1Empty icon={ClipboardList}>
            {error ? error : "No recent tickets"}
          </V1Empty>
        </V1Card>
        <CreateTicketDialog
          open={createOpen}
          storeId={storeId}
          catalogIssues={catalogIssues}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { setCreateOpen(false); fetchTickets(); }}
        />
      </>
    );
  }

  // Data → compact clickable list
  return (
    <>
      <V1Card
        title="Recent Tickets"
        category="quality"
        period="D"
        span={span}
        className={className}
        headerControl={headerActions}
      >
        <table className={V1_TBL}>
          <thead>
            <tr>
              <th className={V1_TH}>#</th>
              <th className={V1_TH}>Status</th>
              <th className={cn(V1_TH, "text-center")}>Issues</th>
              <th className={cn(V1_TH, "text-right")}>Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr
                key={ticket.id}
                className="cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => handleRowClick(ticket)}
              >
                <td className={cn(V1_TD, "font-mono text-muted-foreground")}>
                  {ticket.id}
                </td>
                <td className={V1_TD}>
                  <StatusBadge label={ticket.status.label} value={ticket.status.value} />
                </td>
                <td className={cn(V1_TD, "text-center tabular-nums")}>
                  {ticket.issueCount}
                </td>
                <td className={cn(V1_TD, V1_NUM, "whitespace-nowrap text-muted-foreground")}>
                  {fmtDate(ticket.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </V1Card>

      {sheetOpen && storeId && (
        <TicketDetailSheet
          open={sheetOpen}
          ticketId={selectedTicketId}
          storeId={storeId}
          tickets={tickets}
          technicians={technicians}
          onClose={() => {
            setSheetOpen(false);
            setSelectedTicketId(null);
          }}
        />
      )}

      <CreateTicketDialog
        open={createOpen}
        storeId={storeId}
        catalogIssues={catalogIssues}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => { setCreateOpen(false); fetchTickets(); }}
      />
    </>
  );
}
