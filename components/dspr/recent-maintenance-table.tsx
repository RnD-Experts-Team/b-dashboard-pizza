"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { Ticket, CatalogIssue, CatalogTechnician } from "@/types/maintenance-tickets.types";
import { CreateTicketDialog } from "@/components/maintenance-tickets/create-ticket-dialog";
import { TicketDetailSheet } from "@/components/maintenance-tickets/ticket-detail-sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ClipboardList,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Ticket as TicketIcon,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Status badge                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  open:        "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/30",
  in_progress: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/30",
  waiting:     "bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/30",
  complete:    "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/30",
  deferred:    "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/30",
  cancelled:   "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30",
};

function StatusBadge({ label, value }: { label: string; value: string }) {
  return (
    <Badge
      className={cn(
        "text-[9px] py-0 px-1.5 font-medium whitespace-nowrap",
        STATUS_STYLES[value] ?? "bg-muted text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
    </Badge>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Skeleton                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function TicketsSkeleton() {
  return (
    <Card className="py-1.5 gap-0">
      <CardHeader className="pb-1 px-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5 rounded" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-10 rounded" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-2">
        <div className="space-y-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Skeleton className="h-3 w-6" />
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export function RecentMaintenanceTable() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { selectedStore } = useSelectedStoreStore();
  const storeId = selectedStore?.storeId ?? null;

  // ── Tickets data ─────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Detail sheet ─────────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [technicians, setTechnicians] = useState<CatalogTechnician[]>([]);
  const techLoadedRef = useRef(false);

  // ── Create dialog ────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [catalogIssues, setCatalogIssues] = useState<CatalogIssue[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // ── Fetch tickets ────────────────────────────────────────────────────
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
        ctrl.signal
      );
      if (!ctrl.signal.aborted) {
        setTickets(res.data);
        setTotal(res.meta.total ?? null);
      }
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(
        err instanceof MaintenanceTicketsError ? err.message : "Failed to load tickets."
      );
    } finally {
      if (!ctrl.signal.aborted) setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchTickets();
    return () => abortRef.current?.abort();
  }, [fetchTickets]);

  // ── Open detail sheet ────────────────────────────────────────────────
  async function handleRowClick(ticket: Ticket) {
    setSelectedTicketId(ticket.id);
    setSheetOpen(true);
    // Lazy-load technicians on first open
    if (!techLoadedRef.current) {
      techLoadedRef.current = true;
      try {
        const techs = await maintenanceTicketsService.getCatalogTechnicians();
        setTechnicians(techs);
      } catch {
        // Sheet works fine without technicians for read-only viewing
      }
    }
  }

  // ── Open create dialog ───────────────────────────────────────────────
  async function handleOpenCreate() {
    // Load issues BEFORE opening the dialog so the combobox is already populated
    // when CreateTicketDialog mounts and seeds its local catalog state.
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

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading && tickets.length === 0) return <TicketsSkeleton />;
  if (!storeId) return null;

  // ── Error ────────────────────────────────────────────────────────────
  if (error && tickets.length === 0) {
    return (
      <Card className="py-1.5 gap-0">
        <CardHeader className="pb-1 px-3">
          <CardTitle className="flex items-center gap-1 text-[11px]">
            <TicketIcon className="h-3 w-3" />
            Recent Tickets
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchTickets}>
              <RefreshCw className="h-3.5 w-3.5 me-1.5" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────
  if (!isLoading && tickets.length === 0) {
    return (
      <>
        <Card className="py-1.5 gap-0">
          <CardHeader className="pb-1 px-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-1 text-[11px]">
                <TicketIcon className="h-3 w-3" />
                Recent Tickets
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-0.5 px-2"
                onClick={handleOpenCreate}
                disabled={catalogLoading}
              >
                {catalogLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                New
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3">
            <div className="flex flex-col items-center gap-1.5 py-4 text-center">
              <ClipboardList className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No tickets yet.</p>
            </div>
          </CardContent>
        </Card>
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

  // ── Data table ───────────────────────────────────────────────────────
  return (
    <>
      <Card className="py-1.5 gap-0 bg-linear-to-r from-[#CFDEE7] via-[#E6F6FA] to-[#FBFEFF] dark:from-[#0E2A30]/25 dark:via-[#102F34]/20 dark:to-[#12363B]/18">
        <CardHeader className="pb-1 px-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-1 text-[11px]">
                <TicketIcon className="h-3 w-3 shrink-0" />
                Recent Tickets
              </CardTitle>
              <CardDescription className="text-[9px] mt-0.5">
                {tickets.length}{total != null ? ` of ${total}` : ""} tickets
              </CardDescription>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={fetchTickets}
                disabled={isLoading}
                aria-label="Refresh"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-0.5 px-2"
                onClick={handleOpenCreate}
                disabled={catalogLoading}
                aria-label="Create ticket"
              >
                {catalogLoading
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Plus className="h-3 w-3" />}
                New
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-1.5"
                asChild
                aria-label="View all tickets"
              >
                <Link href={`/${locale}/dashboard/maintenance-tickets`}>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {/* overflow-y scroll, no x overflow */}
          <div className="overflow-x-hidden overflow-y-auto max-h-[140px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-7 px-3 text-[10px] w-10">#</TableHead>
                  <TableHead className="h-7 px-3 text-[10px]">Status</TableHead>
                  <TableHead className="h-7 px-3 text-[10px] text-center w-16">Issues</TableHead>
                  <TableHead className="h-7 px-3 text-[10px] text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className={cn(
                      "cursor-pointer",
                      isLoading && "opacity-60 pointer-events-none"
                    )}
                    onClick={() => handleRowClick(ticket)}
                  >
                    <TableCell className="py-1.5 px-3 font-mono text-[11px] text-muted-foreground">
                      {ticket.id}
                    </TableCell>
                    <TableCell className="py-1.5 px-3">
                      <StatusBadge label={ticket.status.label} value={ticket.status.value} />
                    </TableCell>
                    <TableCell className="py-1.5 px-3 text-center">
                      <span className="inline-flex items-center justify-center gap-0.5 text-[11px] text-muted-foreground">
                        <ClipboardList className="h-3 w-3" />
                        {ticket.issueCount}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5 px-3 text-[11px] text-muted-foreground text-right whitespace-nowrap">
                      {format(new Date(ticket.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail sheet — opens when a row is clicked */}
      {sheetOpen && storeId && (
        <TicketDetailSheet
          open={sheetOpen}
          ticketId={selectedTicketId}
          storeId={storeId}
          tickets={tickets}
          technicians={technicians}
          onClose={() => { setSheetOpen(false); setSelectedTicketId(null); }}
        />
      )}

      {/* Create dialog */}
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
