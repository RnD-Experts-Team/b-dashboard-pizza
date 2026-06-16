"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
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
import {
  AlertTriangle,
  Pencil,
  Paperclip,
  StickyNote,
  Ticket,
  History,
  User,
  Store,
} from "lucide-react";
import {
  dailyPayService,
  DailyPayError,
} from "@/lib/api/services/daily-pay.service";
import type { DailyPayEntry, DailyPayLine } from "@/types/daily-pay.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "MMM d, yyyy");
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "MMM d, yyyy 'at' h:mm a");
}

function money(value: number | null): string {
  return value == null ? "—" : `$${value.toFixed(2)}`;
}

function num(value: number | null, suffix = ""): string {
  return value == null ? "—" : `${value}${suffix}`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Field grid for one line                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

function LineCard({ line, index }: { line: DailyPayLine; index: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-normal">
            Line {index + 1}
          </Badge>
          <span className="flex items-center gap-1 text-sm font-medium">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {line.technician?.name ?? `Technician #${line.technicianId}`}
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Store className="h-3.5 w-3.5" />
            {line.store?.storeNumber ?? `#${line.storeId}`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Field label="Working hours" value={num(line.totalWorkingHours, " h")} />
        <Field label="Break time" value={num(line.totalBreakTime, " h")} />
        <Field label="Travel time" value={num(line.travelTime, " h")} />
        <Field label="Hourly rate" value={money(line.hourlyPaymentRate)} />
        <Field label="Gas" value={money(line.gas)} />
        <Field label="Invoices" value={money(line.invoices)} />
        <Field label="Money owed" value={money(line.moneyOwed)} />
      </div>

      {/* Linked ticket issues */}
      {line.ticketIssues.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Ticket className="h-3.5 w-3.5" />
            Linked ticket issues
          </p>
          <div className="space-y-1">
            {line.ticketIssues.map((ti) => (
              <div
                key={ti.id}
                className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  Ticket #{ti.ticketId}
                </span>
                <span className="font-medium">
                  {ti.issueTitle || ti.otherTitle || `Issue #${ti.id}`}
                </span>
                {ti.status && (
                  <Badge variant="secondary" className="font-normal capitalize">
                    {ti.status}
                  </Badge>
                )}
                {ti.priority && (
                  <Badge variant="outline" className="font-normal capitalize">
                    {ti.priority}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {line.notes.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <StickyNote className="h-3.5 w-3.5" />
            Notes
          </p>
          <div className="space-y-1.5">
            {line.notes.map((note) => (
              <div key={note.id} className="rounded-md border bg-muted/30 p-2.5 text-sm">
                {note.typeLabel && (
                  <Badge variant="secondary" className="mb-1 font-normal">
                    {note.typeLabel}
                  </Badge>
                )}
                <p className="whitespace-pre-wrap">{note.body}</p>
                {note.attachments.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {note.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs text-primary hover:underline"
                      >
                        <Paperclip className="h-3 w-3" />
                        {att.fileName}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Line attachments */}
      {line.attachments.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            Attachments
          </p>
          <div className="flex flex-wrap gap-1.5">
            {line.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-primary hover:underline"
              >
                <Paperclip className="h-3 w-3" />
                {att.fileName}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
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
}

export function DailyPayDetailSheet({
  open,
  entryId,
  onClose,
  onEdit,
  canEdit = true,
}: DailyPayDetailSheetProps) {
  const [entry, setEntry] = useState<DailyPayEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
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
              {/* Meta */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Submitted by</p>
                  <p className="font-medium">{entry.creator?.name ?? "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDateTime(entry.createdAt)}</p>
                </div>
                {canEdit && onEdit && (
                  <Button size="sm" variant="outline" onClick={() => onEdit(entry)}>
                    <Pencil className="me-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </div>

              {/* Lines */}
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold">
                  Lines ({entry.lines.length})
                </h3>
                <div className="space-y-3">
                  {entry.lines.map((line, i) => (
                    <LineCard key={line.id} line={line} index={i} />
                  ))}
                </div>
              </div>

              {/* Revisions */}
              {entry.revisions.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                      <History className="h-4 w-4 text-muted-foreground" />
                      Revision history ({entry.revisions.length})
                    </h3>
                    <div className="space-y-1.5">
                      {entry.revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">
                            Revision #{rev.id}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(rev.createdAt)}
                          </span>
                        </div>
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
