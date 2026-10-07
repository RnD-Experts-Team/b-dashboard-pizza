"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, Loader2, Repeat, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSection } from "@/components/shared/page-section";
import { StatusChip } from "@/components/maintenance-tickets/ticket-chips";
import { LocalTimestamp } from "@/components/maintenance-tickets/local-timestamp";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { IssueHistoryRow } from "@/types/maintenance-tickets.types";

const PAGE_SIZE = 10;

/**
 * "Earlier Oven tickets at this store."
 *
 * The question the coordinator asks before ringing anyone: has this happened
 * here before, who fixed it, and how did it end. One row per earlier ticket at
 * the same store that reported the same catalog issue, newest first -- ten at a
 * time, with more on request.
 *
 * Shown expanded, never folded away: on this page nothing is hidden behind a
 * click. Reference material, so it takes the quiet (tertiary) rank.
 */
export function IssueHistoryPanel({
  storeNumber,
  issueId,
  issueTitle,
  excludeTicketId,
  title,
  className,
}: {
  storeNumber: string;
  issueId: number;
  issueTitle: string;
  /** Leave this ticket out -- normally the one being looked at. */
  excludeTicketId?: number;
  /** Overrides the default heading. */
  title?: string;
  className?: string;
}) {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";

  const [rows, setRows] = useState<IssueHistoryRow[]>([]);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (nextPage: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setError(null);
      try {
        const result = await maintenanceTicketsService.getIssueHistory(
          storeNumber,
          issueId,
          { excludeTicketId, page: nextPage, perPage: PAGE_SIZE },
          controller.signal,
        );
        setRows((prev) => (nextPage === 1 ? result.rows : [...prev, ...result.rows]));
        setPage(result.page);
        setLastPage(result.lastPage);
        setTotal(result.total);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof MaintenanceTicketsError ? err.message : "Could not load earlier tickets.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    },
    [storeNumber, issueId, excludeTicketId],
  );

  useEffect(() => {
    void fetchPage(1);
    return () => abortRef.current?.abort();
  }, [fetchPage]);

  const heading = title ?? `Earlier ${issueTitle} tickets at this store`;

  return (
    <PageSection
      rank="tertiary"
      icon={Repeat}
      title={
        <span>
          {heading}
          {page > 0 && <span className="ms-1.5 normal-case tracking-normal">({total})</span>}
        </span>
      }
      className={className}
    >
      {error && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{error}</span>
          <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => void fetchPage(page > 0 ? page : 1)}>
            Try again
          </Button>
        </div>
      )}

      {!error && page > 0 && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No earlier {issueTitle} tickets at this store. This is the first one on record.
        </p>
      )}

      {rows.length > 0 && (
        <ol className="divide-y rounded-md border bg-background">
          {rows.map((row) => (
            <HistoryRow key={row.ticketId} row={row} locale={locale} />
          ))}
        </ol>
      )}

      {isLoading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Loading earlier tickets…
        </div>
      )}

      {!isLoading && !error && page > 0 && page < lastPage && (
        <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => void fetchPage(page + 1)}>
          Show {Math.min(PAGE_SIZE, total - rows.length)} more
        </Button>
      )}
    </PageSection>
  );
}

function HistoryRow({ row, locale }: { row: IssueHistoryRow; locale: string }) {
  const first = row.issues[0];
  const href = `/${locale}/dashboard/maintenance-tickets/${row.ticketId}?store=${encodeURIComponent(row.storeNumber)}`;

  return (
    <li className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-start sm:gap-4">
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-64">
        <Link href={href} className="font-medium tabular-nums text-primary hover:underline">
          Ticket #{row.ticketId}
        </Link>
        <LocalTimestamp iso={row.createdAt} pattern="MMM d, yyyy" showZone={false} className="text-xs text-muted-foreground" />
        {row.status && <StatusChip value={row.status.value} label={row.status.label} />}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        {first?.description && <p className="text-xs text-foreground/80">{first.description}</p>}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {row.technicians.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Wrench className="h-3 w-3" aria-hidden="true" />
              {row.technicians.map((t) => t.name).join(", ")}
            </span>
          ) : (
            <span>No technician recorded</span>
          )}
          {row.completedAt && (
            <span>
              Completed <LocalTimestamp iso={row.completedAt} pattern="MMM d, yyyy" showZone={false} />
            </span>
          )}
          {row.issues.length > 1 && <span>{row.issues.length} entries on that ticket</span>}
        </p>
      </div>
    </li>
  );
}
