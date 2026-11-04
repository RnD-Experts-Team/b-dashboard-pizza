"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ClipboardList, ExternalLink, Loader2, Plus, RefreshCw } from "lucide-react";

import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { Ticket, CatalogIssue } from "@/types/maintenance-tickets.types";

import { V1Card, type V1CardProps } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { Button } from "@/components/ui/button";
import { CreateTicketDialog } from "@/components/maintenance-tickets/create-ticket-dialog";
import { TicketMiniList } from "@/components/maintenance-tickets/ticket-mini-list";
import { TicketPeekSheet } from "@/components/maintenance-tickets/ticket-peek-sheet";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1MaintenanceCard — Dashboard V1, category "quality", period "D".
 *
 *  The card shell carries the category colour (cyan); the rows carry the
 *  ticket's own status and priority badges — the very ones the tickets list
 *  and the ticket page use (components/maintenance-tickets/status-accent.ts),
 *  so "Waiting on store" is the same amber pill everywhere.
 * ────────────────────────────────────────────────────────────────────────── */

export function V1MaintenanceCard({
  span = 1,
  className,
}: {
  span?: V1CardProps["span"];
  className?: string;
}) {
  const t = useTranslations("maintenanceSystem");
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const { selectedStore } = useSelectedStoreStore();
  const storeId = selectedStore?.storeId ?? null;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [peekTicket, setPeekTicket] = useState<Ticket | null>(null);

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
      if (!ctrl.signal.aborted) setTickets(res.data);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof MaintenanceTicketsError ? err.message : t("common.loadError"));
    } finally {
      if (!ctrl.signal.aborted) setIsLoading(false);
    }
  }, [storeId, t]);

  useEffect(() => {
    fetchTickets();
    return () => abortRef.current?.abort();
  }, [fetchTickets]);

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

  const title = t("tickets.card.title");

  const headerActions = (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        className="h-5 gap-0.5 px-1.5 text-[9px]"
        onClick={handleOpenCreate}
        disabled={catalogLoading}
        aria-label={t("tickets.newTicket")}
      >
        {catalogLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" /> : <Plus className="h-2.5 w-2.5" aria-hidden="true" />}
        {t("tickets.card.new")}
      </Button>
      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" asChild>
        <Link href={`/${locale}/dashboard/maintenance-tickets`} aria-label={t("tickets.card.openAll")}>
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );

  const createDialog = storeId ? (
    <CreateTicketDialog
      open={createOpen}
      storeId={storeId}
      catalogIssues={catalogIssues}
      onClose={() => setCreateOpen(false)}
      onSuccess={() => {
        setCreateOpen(false);
        fetchTickets();
      }}
    />
  ) : null;

  if (isLoading && tickets.length === 0) {
    return <WbrCardSkeleton className={className} />;
  }

  if (!storeId) {
    return (
      <V1Card title={title} category="quality" period="D" span={span} className={className}>
        <V1Empty icon={ClipboardList}>{t("tickets.card.noStore")}</V1Empty>
      </V1Card>
    );
  }

  if (tickets.length === 0) {
    return (
      <>
        <V1Card title={title} category="quality" period="D" span={span} className={className} headerControl={headerActions}>
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-[11px] text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={fetchTickets}>
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                {t("common.retry")}
              </Button>
            </div>
          ) : (
            <V1Empty icon={ClipboardList}>{t("tickets.card.empty")}</V1Empty>
          )}
        </V1Card>
        {createDialog}
      </>
    );
  }

  return (
    <>
      <V1Card title={title} category="quality" period="D" span={span} className={className} headerControl={headerActions}>
        <TicketMiniList tickets={tickets} onOpen={setPeekTicket} dimmed={isLoading} className="-mx-2" />
      </V1Card>

      {/*
        A ticket on a dashboard is a quick look: the peek sheet is READ-ONLY,
        acting on a ticket belongs on the ticket page.
      */}
      <TicketPeekSheet ticket={peekTicket} locale={locale} onClose={() => setPeekTicket(null)} />
      {createDialog}
    </>
  );
}
