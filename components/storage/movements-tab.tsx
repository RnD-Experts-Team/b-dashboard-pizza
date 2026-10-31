"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, History, Loader2, MoreHorizontal, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { useStockMovements, useStorageWrites } from "@/lib/hooks/use-storage";
import { formatMoney, formatQuantity } from "@/lib/maintenance/money";
import { MOVEMENT_TYPES, vocabOptions } from "@/lib/maintenance/vocabulary";
import { canMarkMovementMistaken, partHint, summarizeMovement } from "@/lib/storage/stock-forms";
import { hasMovementFilters, toMovementApiFilters, type MovementUrlFilters } from "@/lib/storage/storage-url";
import { formatWireDateTime } from "@/lib/utils/date-display";
import {
  MovementTypeLabel,
  PaginationBar,
  StorageEmptyState,
  StorageErrorState,
  StorageSkeleton,
  TBL,
  TD,
  TH,
} from "./storage-shared";
import type { Part } from "@/types/maintenance-system";
import type { StockMovement, StorageLocation } from "@/types/storage.types";

/**
 * Movements: the append-only ledger in plain words (Bought · Used · Returned ·
 * Moved · Opening stock · Stock count · Damaged or lost · Undone). A mistake is
 * never deleted: "Mark as mistake" writes an Undone movement that puts the
 * stock back, and the original stays here, struck through.
 */

const ALL = "__all__";

export interface MovementsTabProps {
  filters: MovementUrlFilters;
  onFiltersChange: (patch: Record<string, string | number | null>) => void;
  parts: readonly Part[];
  locations: readonly StorageLocation[];
  canMarkMistaken: boolean;
  revision: number;
  onChanged: () => void;
}

export function MovementsTab({ filters, onFiltersChange, parts, locations, canMarkMistaken, revision, onChanged }: MovementsTabProps) {
  const t = useTranslations("maintenanceSystem");
  const apiFilters = useMemo(() => toMovementApiFilters(filters), [filters]);
  const { rows, meta, isLoading, isRefreshing, error, refresh } = useStockMovements(apiFilters, true, revision);
  const [confirming, setConfirming] = useState<StockMovement | null>(null);
  const filtered = hasMovementFilters(filters);

  const partOptions = useMemo(
    () => [{ value: 0, label: t("storage.movements.allParts") }, ...parts.map((p) => ({ value: p.id, label: p.name, hint: partHint(p) || undefined }))],
    [parts, t],
  );

  const clear = () => onFiltersChange({ type: null, part: null, loc: null, from: null, to: null, page: null });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full space-y-1 sm:w-44">
          <Label className="text-xs text-muted-foreground">{t("storage.movements.type")}</Label>
          <Select value={filters.type ?? ALL} onValueChange={(v) => onFiltersChange({ type: v === ALL ? null : v, page: null })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("storage.movements.allTypes")}</SelectItem>
              {vocabOptions(MOVEMENT_TYPES).map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  <MovementTypeLabel type={entry.value} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1 sm:w-56">
          <Label className="text-xs text-muted-foreground">{t("storage.stock.part")}</Label>
          <SearchableSelect
            options={partOptions}
            value={filters.partId ?? 0}
            onChange={(id) => onFiltersChange({ part: id || null, page: null })}
            searchPlaceholder={t("storage.record.partSearch")}
            emptyText={t("storage.record.noParts")}
          />
        </div>
        <div className="w-full space-y-1 sm:w-44">
          <Label className="text-xs text-muted-foreground">{t("storage.movements.location")}</Label>
          <Select value={filters.locationId ? String(filters.locationId) : ALL} onValueChange={(v) => onFiltersChange({ loc: v === ALL ? null : Number(v), page: null })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("storage.stock.allLocations")}</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="mv-from" className="text-xs text-muted-foreground">
            {t("storage.movements.from")}
          </Label>
          <Input id="mv-from" type="date" className="h-9 w-40" value={filters.from ?? ""} onChange={(e) => onFiltersChange({ from: e.target.value || null, page: null })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mv-to" className="text-xs text-muted-foreground">
            {t("storage.movements.to")}
          </Label>
          <Input id="mv-to" type="date" className="h-9 w-40" value={filters.to ?? ""} onChange={(e) => onFiltersChange({ to: e.target.value || null, page: null })} />
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" className="h-9" onClick={clear}>
            {t("common.clearAll")}
          </Button>
        )}
      </div>

      {error && rows.length === 0 && <StorageErrorState message={error.message} onRetry={() => void refresh()} />}
      {!error && isLoading && rows.length === 0 && <StorageSkeleton />}
      {!error && !isLoading && rows.length === 0 && (
        <StorageEmptyState
          icon={History}
          description={filtered ? t("storage.movements.emptyFiltered") : t("storage.movements.empty")}
          action={
            filtered ? (
              <Button variant="outline" size="sm" onClick={clear}>
                {t("common.clearAll")}
              </Button>
            ) : undefined
          }
        />
      )}
      {rows.length > 0 && (
        <>
          <div className={cn("overflow-x-auto rounded-md border bg-card", isRefreshing && "opacity-70")}>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>{t("storage.movements.when")}</th>
                  <th className={TH}>{t("storage.movements.what")}</th>
                  <th className={TH}>{t("storage.stock.part")}</th>
                  <th className={TH}>{t("storage.stock.where")}</th>
                  <th className={TH}>{t("storage.movements.linked")}</th>
                  <th className={cn(TH, "text-end")}>{t("stock.value")}</th>
                  <th className={TH}>
                    <span className="sr-only">{t("storage.movements.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <MovementRow key={m.id} movement={m} canMarkMistaken={canMarkMistaken} onMarkMistaken={() => setConfirming(m)} />
                ))}
              </tbody>
            </table>
          </div>
          {meta && (
            <PaginationBar
              currentPage={meta.currentPage}
              lastPage={meta.lastPage}
              onPageChange={(page) => onFiltersChange({ page: page > 1 ? page : null })}
              disabled={isRefreshing}
            />
          )}
        </>
      )}

      <MistakeConfirm
        movement={confirming}
        onClose={() => setConfirming(null)}
        onDone={() => {
          setConfirming(null);
          onChanged();
        }}
      />
    </div>
  );
}

function MovementRow({
  movement,
  canMarkMistaken,
  onMarkMistaken,
}: {
  movement: StockMovement;
  canMarkMistaken: boolean;
  onMarkMistaken: () => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const locale = useLocale();
  const summary = summarizeMovement(movement);
  const struck = movement.mistaken && "line-through decoration-muted-foreground/60";
  const canUndo = canMarkMistaken && canMarkMovementMistaken(movement);

  return (
    <tr className={cn(movement.mistaken && "bg-muted/30 text-muted-foreground")}>
      <td className={cn(TD, "whitespace-nowrap tabular-nums")}>
        {formatWireDateTime(movement.movedAt, { dateTimePattern: "MMM d, yyyy h:mm a" })}
        {movement.creator && <p className="text-[11px] text-muted-foreground">{movement.creator.name}</p>}
      </td>
      <td className={TD}>
        <MovementTypeLabel type={movement.type.value} serverLabel={movement.type.label} className={cn("font-medium", struck)} />
        {movement.mistaken && (
          <Badge variant="outline" className="mt-1 h-4 border-red-500/40 px-1 text-[10px] text-red-700 dark:text-red-400">
            {t("common.mistaken")}
          </Badge>
        )}
      </td>
      <td className={cn(TD, struck)}>
        <ul className="space-y-0.5">
          {summary.parts.map((p) => (
            <li key={p.id}>
              <span className="font-medium">{p.name}</span>{" "}
              <span className="tabular-nums text-muted-foreground">× {formatQuantity(p.quantity)}</span>
            </li>
          ))}
        </ul>
        {summary.serials.length > 0 && <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{summary.serials.join(", ")}</p>}
      </td>
      <td className={cn(TD, struck)}>
        <WhereCell from={summary.from} to={summary.to} />
      </td>
      <td className={TD}>
        {movement.ticketIssue && (
          <Link
            href={`/${locale}/dashboard/maintenance-tickets/${movement.ticketIssue.ticketId}?issue=${movement.ticketIssue.id}`}
            className="block hover:underline"
          >
            {t("storage.issue.line", { ticket: movement.ticketIssue.ticketId, store: movement.ticketIssue.storeNumber ?? "—" })}
            <span className="block truncate text-[11px] text-muted-foreground">{movement.ticketIssue.title}</span>
          </Link>
        )}
        {movement.payment && (
          <span className="block">{t("storage.movements.payment", { id: movement.payment.id, name: movement.payment.paidToName ?? "—" })}</span>
        )}
        {movement.stockCountId && (
          <Link href={`/${locale}/dashboard/storage/counts/${movement.stockCountId}`} className="block hover:underline">
            {t("storage.movements.count", { id: movement.stockCountId })}
          </Link>
        )}
        {movement.reversalOfId && <span className="block">{t("storage.movements.cancels", { id: movement.reversalOfId })}</span>}
      </td>
      <td className={cn(TD, "text-end tabular-nums", struck)}>{movement.totalCost ? formatMoney(movement.totalCost) : "—"}</td>
      <td className={cn(TD, "text-end")}>
        {canUndo && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("storage.movements.actionsFor", { id: movement.id })}>
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onMarkMistaken} className="text-destructive focus:text-destructive">
                <Undo2 className="me-2 h-3.5 w-3.5" aria-hidden="true" />
                {t("common.markAsMistake")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}

function WhereCell({ from, to }: { from: string[]; to: string[] }) {
  if (from.length && to.length) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {from.join(", ")}
        <ArrowRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
        {to.join(", ")}
      </span>
    );
  }
  return <span>{[...from, ...to].join(", ") || "—"}</span>;
}

function MistakeConfirm({ movement, onClose, onDone }: { movement: StockMovement | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("maintenanceSystem");
  const { markMistaken } = useStorageWrites();

  async function confirm() {
    if (!movement) return;
    try {
      await markMistaken.run(movement.id);
      toast.success(t("storage.movements.markedMistake"));
      onDone();
    } catch (err) {
      if (!isCancelled(err)) toast.error(err instanceof Error ? err.message : t("common.saveError"));
    }
  }

  return (
    <AlertDialog open={movement != null} onOpenChange={(open) => !open && !markMistaken.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading font-semibold">{t("common.markAsMistake")}</AlertDialogTitle>
          <AlertDialogDescription>{t("storage.movements.mistakeBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={markMistaken.isPending}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={markMistaken.isPending}
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {markMistaken.isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {t("common.markAsMistake")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
