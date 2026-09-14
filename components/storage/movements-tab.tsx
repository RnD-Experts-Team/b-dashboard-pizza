"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWireDateTime } from "@/lib/utils/date-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { storageService } from "@/lib/api/services/storage.service";
import { entityPaths, MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";
import { isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { findOriginalFor, findReversalFor } from "@/lib/storage/reversal-pairing";
import { EntityNotesAttachments } from "@/components/maintenance-tickets/entity-extras";
import { MovementComposer } from "./movement-composer";
import {
  PaginationBar,
  SignedQty,
  StorageEmptyState,
  StorageErrorCard,
  StorageSkeleton,
  TBL,
  TD,
  TH,
} from "./storage-shared";
import type { CatalogPart } from "@/types/maintenance-tickets.types";
import type {
  StockMovement,
  StockMovementFilters,
  StockMovementListResponse,
  StorageErrorState,
  StorageLocation,
} from "@/types/storage.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  The stock ledger                                                         */
/*                                                                            */
/*  ⚠ A MISTAKEN MOVEMENT STILL COUNTS. It stays in every balance exactly as  */
/*  before it was flagged — the flag is a display marker, and the correction  */
/*  is the separate reversal movement.                                       */
/*                                                                            */
/*  So: nothing here filters a mistaken movement out, nothing labels it       */
/*  "excluded", and it renders struck through and PAIRED with its reversal so */
/*  one correction reads as one correction rather than two.                  */
/*                                                                            */
/*  ⚠ Never sum this page to get on hand. The ledger is unfiltered and        */
/*  paginated; on hand comes from GET /stock-balances.                       */
/* ────────────────────────────────────────────────────────────────────────── */

function MovementRow({
  movement,
  page,
  canManage,
  onMarkMistaken,
  pendingId,
  onChanged,
}: {
  movement: StockMovement;
  page: StockMovement[];
  canManage: boolean;
  onMarkMistaken: (m: StockMovement) => void;
  pendingId: number | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);

  const isReversal = movement.type.value === "reversal";
  const reversal = findReversalFor(movement, page);
  const original = findOriginalFor(movement, page);
  // A mistaken movement with no identifiable reversal on this page: say so
  // rather than leaving the strikethrough unexplained, and never imply the
  // reversal does not exist.
  const unpairedMistake = movement.mistaken && !reversal;

  const strike = movement.mistaken ? "line-through" : "";
  const lines = movement.lines;

  return (
    <>
      <tr
        className={cn(
          "cursor-pointer transition-colors hover:bg-muted/40",
          movement.mistaken && "opacity-70"
        )}
        onClick={() => setOpen(!open)}
      >
        <td className={TD}>
          <span className="font-mono text-[11px] text-muted-foreground">#{movement.id}</span>
        </td>
        <td className={TD}>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={cn("font-medium", strike)}>{movement.type.label}</span>
            {movement.mistaken && (
              <Badge
                variant="outline"
                className="h-4 gap-1 border-destructive/30 bg-destructive/10 px-1 text-[9px] font-normal text-destructive"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                Mistaken
              </Badge>
            )}
            {isReversal && (
              <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                Reversal
              </Badge>
            )}
          </span>
        </td>
        <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>
          {formatWireDateTime(movement.movedAt)}
        </td>
        <td className={TD}>
          {lines == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className={cn("text-muted-foreground", strike)}>
              {lines.length} {lines.length === 1 ? "line" : "lines"}
            </span>
          )}
        </td>
        <td className={TD}>
          {movement.paidBy ? (
            <span className={strike}>
              {movement.paidBy.label}
              {movement.paidByTechnician && ` · ${movement.paidByTechnician.name}`}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className={cn(TD, "text-end")}>
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canManage && !movement.mistaken && !isReversal && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={pendingId !== null}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onMarkMistaken(movement)}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Mark as Mistaken
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </div>
        </td>
      </tr>

      {/* The pair, stated so one correction reads as one correction */}
      {(reversal || original || unpairedMistake) && (
        <tr>
          <td colSpan={6} className="border-t-0 px-2.5 pb-1.5">
            <p className="text-[11px] text-muted-foreground">
              {reversal && (
                <>
                  ⓘ Still counted. Cancelled by reversal{" "}
                  <span className="font-mono">#{reversal.id}</span>.
                </>
              )}
              {original && (
                <>
                  ⓘ Reverses <span className="font-mono">#{original.id}</span>.
                </>
              )}
              {unpairedMistake && !reversal && (
                <>ⓘ Still counted. Its reversal is not on this page.</>
              )}
            </p>
          </td>
        </tr>
      )}

      {open && (
        <tr>
          <td colSpan={6} className="border-t bg-muted/20 p-3">
            <div className="space-y-3">
              {lines == null ? (
                <p className="text-[11px] text-muted-foreground">
                  Lines were not included in this response.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border bg-card">
                  <table className={TBL}>
                    <thead>
                      <tr>
                        <th className={TH}>Part</th>
                        <th className={TH}>Location</th>
                        <th className={cn(TH, "text-end")}>Change</th>
                        <th className={cn(TH, "text-end")}>Unit cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id}>
                          <td className={cn(TD, strike)}>
                            {line.part?.name ?? `Part #${line.partId}`}
                          </td>
                          <td className={cn(TD, strike)}>
                            {line.storageLocation?.name ??
                              `Location #${line.storageLocationId}`}
                          </td>
                          <td className={cn(TD, "text-end", strike)}>
                            <SignedQty value={line.signedQuantity} />
                          </td>
                          <td className={cn(TD, "text-end tabular-nums", strike)}>
                            {line.unitCost != null ? `$${line.unitCost.toFixed(2)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <EntityNotesAttachments
                entityPath={entityPaths.stockMovement(movement.id)}
                notes={movement.notes ?? []}
                attachments={movement.attachments ?? []}
                onSuccess={onChanged}
                canAdd={canManage}
                alwaysOpen
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

interface MovementsTabProps {
  data: StockMovementListResponse | null;
  isLoading: boolean;
  error: StorageErrorState | null;
  filters: StockMovementFilters;
  onFiltersChange: (filters: StockMovementFilters, page?: number) => void;
  parts: CatalogPart[];
  allLocations: StorageLocation[];
  liveLocations: StorageLocation[];
  canCreate: boolean;
  onChanged: () => void;
}

export function MovementsTab({
  data,
  isLoading,
  error,
  filters,
  onFiltersChange,
  parts,
  liveLocations,
  canCreate,
  onChanged,
}: MovementsTabProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [pendingMistake, setPendingMistake] = useState<StockMovement | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const page = useMemo(() => data?.data ?? [], [data]);

  async function confirmMistaken(movement: StockMovement) {
    setPendingId(movement.id);
    try {
      const result = await storageService.markStockMovementMistaken(movement.id);
      toast.success(
        result.reversal
          ? `Movement #${movement.id} flagged · reversal #${result.reversal.id} created`
          : `Movement #${movement.id} flagged`
      );
      onChanged();
    } catch (err) {
      if (isCancelled(err)) return;
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Something went wrong."
      );
    } finally {
      setPendingId(null);
      setPendingMistake(null);
    }
  }

  if (isLoading && !data) return <StorageSkeleton />;
  if (error && !data) {
    return <StorageErrorCard error={error} onRetry={() => onFiltersChange(filters, 1)} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Append-only. Corrections are recorded as reversals, never as edits.
        </p>
        {canCreate && (
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setComposerOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New movement
          </Button>
        )}
      </div>

      {page.length === 0 ? (
        <StorageEmptyState
          title="No stock movements yet"
          description="Every purchase, draw, return and transfer is recorded here. Start by recording what you already have as an initial count."
          action={
            canCreate ? (
              <Button size="sm" onClick={() => setComposerOpen(true)}>
                <Plus className="me-1.5 h-3.5 w-3.5" />
                New movement
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>ID</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Moved at</th>
                  <th className={TH}>Lines</th>
                  <th className={TH}>Paid by</th>
                  <th className={cn(TH, "text-end")} />
                </tr>
              </thead>
              <tbody>
                {page.map((movement) => (
                  <MovementRow
                    key={movement.id}
                    movement={movement}
                    page={page}
                    canManage={canCreate}
                    onMarkMistaken={setPendingMistake}
                    pendingId={pendingId}
                    onChanged={onChanged}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {data && (
            <PaginationBar
              currentPage={data.meta.currentPage}
              lastPage={data.meta.lastPage}
              onPageChange={(p) => onFiltersChange(filters, p)}
              disabled={isLoading}
            />
          )}
        </>
      )}

      <MovementComposer
        open={composerOpen}
        parts={parts}
        locations={liveLocations}
        onClose={() => setComposerOpen(false)}
        onSuccess={onChanged}
      />

      {/* The copy matters: this writes a reversing movement, it does not undo. */}
      <AlertDialog
        open={pendingMistake !== null}
        onOpenChange={(o) => !o && setPendingMistake(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark movement #{pendingMistake?.id} as mistaken?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This does not delete or edit anything. It flags the movement and records a
              new, equal-and-opposite reversal that cancels it — both stay in the ledger
              as the audit trail, and the balance ends up where it should be.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingMistake && confirmMistaken(pendingMistake)}
            >
              Mark mistaken &amp; reverse
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
