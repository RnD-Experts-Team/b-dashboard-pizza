"use client";

import { useMemo } from "react";
import { ChevronDown, PackagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaymentDialog, type PaymentPrefill } from "@/components/maintenance-payments/payment-dialog";
import { STOCK_ACTIONS, type StockActionId } from "@/lib/storage/stock-actions";
import { StockActionDialog, type StockActionPrefill } from "./stock-action-dialog";
import { StockIcon } from "./storage-shared";
import type { Part } from "@/types/maintenance-v2";
import type { StockMovement, StorageLocation } from "@/types/storage.types";

/**
 * The Stock tab's primary action: "Record stock" → Parts bought (the payment
 * dialog with a parts line into storage — a Bought movement only ever comes
 * from a payment) · Used on a ticket · Returned · Moved · Opening stock ·
 * Damaged or lost.
 */

export interface PendingStockAction {
  id: StockActionId;
  prefill?: StockActionPrefill;
}

export function RecordStockMenu({
  onPick,
  disabled,
  canRecordMovements,
  canRecordPayments,
}: {
  onPick: (id: StockActionId) => void;
  disabled?: boolean;
  canRecordMovements: boolean;
  canRecordPayments: boolean;
}) {
  const t = useTranslations("maintenanceV2");
  const [bought, ...movements] = STOCK_ACTIONS;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={disabled || (!canRecordMovements && !canRecordPayments)}>
          <PackagePlus className="me-1.5 h-4 w-4" aria-hidden="true" />
          {t("stock.recordStock")}
          <ChevronDown className="ms-1.5 h-3.5 w-3.5 opacity-70" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <ActionItem id={bought.id} icon={bought.icon} disabled={!canRecordPayments} onPick={onPick} />
        <DropdownMenuSeparator />
        {movements.map((a) => (
          <ActionItem key={a.id} id={a.id} icon={a.icon} disabled={!canRecordMovements} onPick={onPick} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActionItem({
  id,
  icon,
  disabled,
  onPick,
}: {
  id: StockActionId;
  icon: string;
  disabled: boolean;
  onPick: (id: StockActionId) => void;
}) {
  const t = useTranslations("maintenanceV2");
  return (
    <DropdownMenuItem disabled={disabled} onSelect={() => onPick(id)} className="items-start gap-2 py-2">
      <StockIcon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{t(`stock.actions.${id}.label`)}</span>
        <span className="block text-[11px] leading-snug text-muted-foreground">{t(`stock.actions.${id}.help`)}</span>
      </span>
    </DropdownMenuItem>
  );
}

/** Renders the dialog for the picked action (or the payment dialog for parts bought). */
export function StockActionHost({
  pending,
  onClose,
  parts,
  locations,
  defaultLocationId,
  canDeclareSpots,
  onRecorded,
}: {
  pending: PendingStockAction | null;
  onClose: () => void;
  parts: readonly Part[];
  locations: readonly StorageLocation[];
  /** The location the page is filtered to, as the default destination. */
  defaultLocationId?: number;
  canDeclareSpots: boolean;
  onRecorded: (movement?: StockMovement) => void;
}) {
  const id = pending?.id ?? null;
  const paymentPrefill = useMemo<PaymentPrefill>(
    () => ({ partsIntoStorage: true, storageLocationId: pending?.prefill?.locationId ?? defaultLocationId }),
    [pending?.prefill?.locationId, defaultLocationId],
  );
  const movementType = id && id !== "bought" ? id : null;

  return (
    <>
      <PaymentDialog
        open={id === "bought"}
        onOpenChange={(open) => !open && onClose()}
        prefill={paymentPrefill}
        onSaved={() => onRecorded()}
      />
      {movementType && (
        <StockActionDialog
          key={movementType}
          open
          onOpenChange={(open) => !open && onClose()}
          type={movementType}
          parts={parts}
          locations={locations}
          prefill={pending?.prefill ?? (defaultLocationId ? { locationId: defaultLocationId } : undefined)}
          canDeclareSpots={canDeclareSpots}
          onRecorded={onRecorded}
        />
      )}
    </>
  );
}
