"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  ChevronDown,
  History,
  Loader2,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dailyPayService, DailyPayError } from "@/lib/api/services/daily-pay.service";
import { entryTotal, formatMoney } from "@/lib/daily-pay/money";
import { parseRevisionSnapshot, snapshotVersionLabel } from "@/lib/daily-pay/revision-snapshot";
import { DailyPayPaymentDetailCard } from "./daily-pay-payment-detail-card";
import { DailyPayRevisionViewer } from "./daily-pay-revision-viewer";
import type { DailyPayEntry, DailyPayRevision } from "@/types/daily-pay.types";
import type { CatalogTechnician } from "@/types/maintenance-tickets.types";
import type { DailyPayStoreOption } from "@/lib/hooks/use-daily-pay";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Formats a plain "YYYY-MM-DD" workday date without shifting to a UTC day boundary. */
function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : format(d, "MMM d, yyyy");
  }
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy");
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "MMM d, yyyy 'at' h:mm a");
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Revision row                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function RevisionRow({
  revision,
  technicians,
  stores,
}: {
  revision: DailyPayRevision;
  technicians: CatalogTechnician[];
  stores: DailyPayStoreOption[];
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseRevisionSnapshot(revision.schemaVersion, revision.snapshot);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/50">
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">Revision #{revision.id}</span>
          <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
            {snapshotVersionLabel(parsed)}
          </Badge>
          {revision.editor?.name && (
            <span className="text-xs text-muted-foreground">by {revision.editor.name}</span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDateTime(revision.createdAt)}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t p-3">
          <DailyPayRevisionViewer
            revision={revision}
            technicians={technicians}
            stores={stores}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Sheet                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface DailyPayDetailSheetProps {
  open: boolean;
  entryId: number | null;
  onClose: () => void;
  onEdit?: (entry: DailyPayEntry) => void;
  canEdit?: boolean;
  /** Called after a recalculate, so the list picks up the moved totals. */
  onChanged?: () => void;
  /** Used to resolve the ids inside revision snapshots to names. */
  technicians?: CatalogTechnician[];
  stores?: DailyPayStoreOption[];
}

export function DailyPayDetailSheet({
  open,
  entryId,
  onClose,
  onEdit,
  canEdit = true,
  onChanged,
  technicians = [],
  stores = [],
}: DailyPayDetailSheetProps) {
  const [entry, setEntry] = useState<DailyPayEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    if (!open || entryId == null) return;
    const ctrl = new AbortController();
    setIsLoading(true);
    setError(null);
    setEntry(null);

    dailyPayService
      .getEntry(entryId, ctrl.signal)
      .then((result) => {
        if (ctrl.signal.aborted) return;
        setEntry(result);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        // Ignore cancelled requests — not a user-visible error.
        if (err instanceof DailyPayError && err.code === "CANCELLED") return;
        setError(err instanceof DailyPayError ? err.message : "Failed to load entry.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setIsLoading(false);
      });

    return () => ctrl.abort();
  }, [open, entryId]);

  async function handleRecalculate() {
    if (entryId == null) return;
    setIsRecalculating(true);
    try {
      const result = await dailyPayService.recalculateEntry(entryId);
      setEntry(result);
      toast.success("Hours and parts re-pulled from attendance.");
      // Totals move, so the list behind the sheet is now stale.
      onChanged?.();
    } catch (err) {
      if (err instanceof DailyPayError && err.code === "CANCELLED") return;
      toast.error(err instanceof DailyPayError ? err.message : "Failed to recalculate.");
    } finally {
      setIsRecalculating(false);
    }
  }

  const total = entry ? entryTotal(entry) : null;
  const payments = entry?.payments ?? null;
  const revisions = entry?.revisions ?? null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {entry ? `Daily Pay Entry #${entry.id}` : "Daily Pay Entry"}
          </SheetTitle>
          <SheetDescription>
            {entry
              ? `Workday ${formatDate(entry.date)}`
              : "End-of-day technician payment record."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {/* Loading */}
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 p-8 text-center">
              <AlertTriangle className="mb-2 h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Content */}
          {!isLoading && !error && entry && (
            <>
              {/* Meta + entry total */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Submitted by</p>
                  <p className="font-medium">{entry.creator?.name ?? "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDateTime(entry.createdAt)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Entry total</p>
                  <p className="text-base font-semibold tabular-nums">{formatMoney(total)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* This tooltip is load-bearing: recalculate deliberately does
                      nothing to overridden lines, so a user who overrode
                      everything will report the button as broken without it. */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRecalculate}
                        disabled={isRecalculating}
                      >
                        {isRecalculating ? (
                          <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="me-1.5 h-3.5 w-3.5" />
                        )}
                        Recalculate hours
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      Re-pulls hours and reimbursable parts from attendance. Lines with
                      overridden hours are left as they are.
                    </TooltipContent>
                  </Tooltip>
                  {canEdit && onEdit && (
                    <Button size="sm" variant="outline" onClick={() => onEdit(entry)}>
                      <Pencil className="me-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>

              {/* Payments */}
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold">
                  Payments ({payments?.length ?? 0})
                </h3>
                {payments == null ? (
                  <p className="text-sm text-muted-foreground">Payments were not loaded.</p>
                ) : payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This entry has no payments.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment, i) => (
                      <DailyPayPaymentDetailCard
                        key={payment.id}
                        payment={payment}
                        index={i}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Revisions */}
              {revisions != null && revisions.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                      <History className="h-4 w-4 text-muted-foreground" />
                      Revision history ({revisions.length})
                    </h3>
                    <div className="space-y-1.5">
                      {revisions.map((rev) => (
                        <RevisionRow
                          key={rev.id}
                          revision={rev}
                          technicians={technicians}
                          stores={stores}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
