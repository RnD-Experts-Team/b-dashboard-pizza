"use client";

import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { Check, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useInspectionLookup } from "@/lib/hooks/use-maintenance-payments";
import { useDebouncedValue } from "@/lib/hooks/use-toolbox-tickets-poll";
import { formatMoney } from "@/lib/maintenance/money";
import type { IssueInspectionLookupRow } from "@/types/maintenance-v2";

const SEARCH_DEBOUNCE_MS = 300;
/** The lookup's largest answer. */
const LOOKUP_LIMIT = 100;
const DAY_PATTERN = "MMM d";

const PAID_TONE = "border-emerald-500/40 text-emerald-700 dark:text-emerald-400";
const UNPAID_TONE = "border-amber-500/40 text-amber-700 dark:text-amber-400";

function shortDay(raw: string | null): string | null {
  if (!raw) return null;
  const d = parseISO(raw);
  return isValid(d) ? format(d, DAY_PATTERN) : null;
}

/**
 * The Inspection line's "which inspection is this for?" (`GET
 * issue-inspections`): the payment's technician's inspections not paid yet,
 * newest first, with a search and a "show paid ones too" switch. Each row says
 * the issue, store, technician, quote and whether it is paid. Picking one sets
 * the line's `issueInspectionId`; picking it again clears it.
 */
export function InspectionPicker({
  id,
  technicianId,
  value,
  onPick,
  invalid,
}: {
  id?: string;
  /** The payment's technician; null = paid to a supplier (every technician's are listed). */
  technicianId: number | null;
  value: number | null;
  onPick: (row: IssueInspectionLookupRow | null) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("maintenanceV2");
  const [search, setSearch] = useState("");
  // Editing a payment: its own inspection now reads as paid, so start with paid ones shown.
  const [showPaid, setShowPaid] = useState(value != null);
  const debounced = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const { inspections, isLoading, error, refresh } = useInspectionLookup({
    technicianId: technicianId ?? undefined,
    unpaid: !showPaid,
    search: debounced || undefined,
    limit: LOOKUP_LIMIT,
  });
  const chosenMissing = value != null && !inspections.some((row) => row.id === value);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("payments.inspection.searchPlaceholder")}
            aria-label={t("payments.inspection.searchPlaceholder")}
            className="h-8 ps-8 text-sm"
            autoComplete="off"
          />
          {isLoading && (
            <Loader2 className="absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <Checkbox checked={showPaid} onCheckedChange={(v) => setShowPaid(v === true)} />
          {t("payments.inspection.showPaid")}
        </label>
      </div>

      <div
        id={id}
        tabIndex={-1}
        role="radiogroup"
        aria-label={t("payments.inspection.label")}
        className={cn("max-h-52 divide-y overflow-y-auto rounded-md border bg-background", invalid && "border-destructive")}
      >
        {chosenMissing && (
          <div className="flex items-center gap-2.5 bg-accent px-3 py-2 text-xs">
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex-1 font-medium">{t("payments.inspection.chosen", { id: value })}</span>
            <button
              type="button"
              onClick={() => onPick(null)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label={t("payments.inspection.clear")}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        {error && (
          <button type="button" onClick={() => void refresh()} className="w-full px-3 py-2 text-start text-[11px] text-destructive hover:underline">
            {t("common.loadError")} {t("common.retry")}
          </button>
        )}
        {!error && !isLoading && inspections.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {showPaid || debounced || technicianId == null ? t("payments.inspection.none") : t("payments.inspection.noneUnpaid")}
          </p>
        )}
        {inspections.map((row) => (
          <InspectionRow key={row.id} row={row} on={row.id === value} onPick={() => onPick(row.id === value ? null : row)} />
        ))}
      </div>
    </div>
  );
}

function InspectionRow({ row, on, onPick }: { row: IssueInspectionLookupRow; on: boolean; onPick: () => void }) {
  const t = useTranslations("maintenanceV2");
  const issue = row.ticketIssue;
  const done = shortDay(row.doneAt);
  const booked = shortDay(row.scheduledDate);
  const where = issue?.store ? t("trips.storeN", { number: issue.store.storeNumber }) : issue?.otherStore ?? null;
  const when =
    [
      done && t("payments.inspection.doneOn", { date: done }),
      booked && t("payments.inspection.bookedFor", { date: booked }),
    ].find(Boolean) || row.statusLabel;
  const meta = [where, row.technician?.name, when].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors hover:bg-muted/40", on && "bg-accent")}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          on ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
      >
        {on && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">
          {issue ? `#${issue.ticketId} · ${issue.title}` : t("payments.inspection.chosen", { id: row.id })}
        </span>
        {meta && <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        {row.estimatedCost != null && (
          <span className="text-xs font-medium tabular-nums">{t("payments.inspection.quote", { amount: formatMoney(row.estimatedCost) })}</span>
        )}
        <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", row.paid ? PAID_TONE : UNPAID_TONE)}>
          {row.paid ? t("payments.inspection.paid") : t("payments.inspection.notPaid")}
        </Badge>
      </span>
    </button>
  );
}
