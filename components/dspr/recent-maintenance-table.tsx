"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { Ticket, CatalogIssue } from "@/types/maintenance-tickets.types";
import { CreateTicketDialog } from "@/components/maintenance-tickets/create-ticket-dialog";
import { TicketMiniList } from "@/components/maintenance-tickets/ticket-mini-list";
import { TicketPeekSheet } from "@/components/maintenance-tickets/ticket-peek-sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  const t = useTranslations("maintenanceSystem");
  const { selectedStore } = useSelectedStoreStore();
  const storeId = selectedStore?.storeId ?? null;

  // ── Tickets data ─────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Detail sheet ─────────────────────────────────────────────────────
  const [peekTicket, setPeekTicket] = useState<Ticket | null>(null);

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
        err instanceof MaintenanceTicketsError ? err.message : t("common.loadError")
      );
    } finally {
      if (!ctrl.signal.aborted) setIsLoading(false);
    }
  }, [storeId, t]);

  useEffect(() => {
    fetchTickets();
    return () => abortRef.current?.abort();
  }, [fetchTickets]);

  // ── Open detail sheet ────────────────────────────────────────────────
  function handleRowClick(ticket: Ticket) {
    setPeekTicket(ticket);
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
            {t("tickets.card.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchTickets}>
              <RefreshCw className="h-3.5 w-3.5 me-1.5" aria-hidden="true" />
              {t("common.retry")}
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
                {t("tickets.card.title")}
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-0.5 px-2"
                onClick={handleOpenCreate}
                disabled={catalogLoading}
              >
                {catalogLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                {t("tickets.card.new")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3">
            <div className="flex flex-col items-center gap-1.5 py-4 text-center">
              <ClipboardList className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">{t("tickets.card.empty")}</p>
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
                {t("tickets.card.title")}
              </CardTitle>
              <CardDescription className="text-[9px] mt-0.5">
                {total != null ? t("tickets.card.countOf", { shown: tickets.length, total }) : t("tickets.card.count", { count: tickets.length })}
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
                aria-label={t("common.refresh")}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-0.5 px-2"
                onClick={handleOpenCreate}
                disabled={catalogLoading}
                aria-label={t("tickets.newTicket")}
              >
                {catalogLoading
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Plus className="h-3 w-3" />}
                {t("tickets.card.new")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-1.5"
                asChild
                aria-label={t("tickets.card.openAll")}
              >
                <Link href={`/${locale}/dashboard/maintenance-tickets`}>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          <div className="max-h-[140px] overflow-y-auto overflow-x-hidden px-1">
            <TicketMiniList tickets={tickets} onOpen={handleRowClick} dimmed={isLoading} />
          </div>
        </CardContent>
      </Card>

      {/*
        Detail sheet — opens when a row is clicked. READ-ONLY here, unlike the
        maintenance tickets page.

        A ticket on a dashboard is a quick showcase: you glance to see whether
        something needs you, and go back. Acting on one belongs on the tickets
        page — offering half the controls here as well would only split one
        habit across two screens.
      */}
      <TicketPeekSheet ticket={peekTicket} locale={locale} onClose={() => setPeekTicket(null)} />

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
