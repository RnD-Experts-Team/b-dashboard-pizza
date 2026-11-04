"use client";

import { useState } from "react";
import { Loader2, MapPin, MapPinPlus, MoveRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { storageService } from "@/lib/api/services/storage.service";
import { isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { placeLabel } from "@/lib/storage/stock-forms";
import { useResetOnOpen } from "./discard-guard";
import { SpotPicker } from "./spot-picker";
import type { StockPlaceLine } from "@/types/storage.types";

/**
 * Say where a part sits inside a location ("Zone A › Shelf S").
 *
 * Saving sends the COMPLETE address: a level left blank is cleared (PUT
 * stock-balances/{id}/place). The count is never touched — "Move to spot"
 * inside one location is only this, never a movement.
 */

interface PlacePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The (part, location) balance row being addressed; null = looked up on save. */
  balanceId: number | null;
  partId: number;
  locationId: number;
  locationName: string;
  partName: string;
  current: StockPlaceLine[];
  /** May add a missing Zone/Shelf name on the spot. */
  canManage: boolean;
  onSaved: (place: StockPlaceLine[]) => void;
  /** Opens the Locations tab on this location (no levels laid out yet). */
  onSetUp?: (locationId: number) => void;
}

export function PlacePickerDialog({
  open,
  onOpenChange,
  balanceId,
  partId,
  locationId,
  locationName,
  partName,
  current,
  canManage,
  onSaved,
  onSetUp,
}: PlacePickerDialogProps) {
  const t = useTranslations("maintenanceSystem");
  const [chosen, setChosen] = useState<number[]>(() => current.map((l) => l.valueId));
  const [saving, setSaving] = useState(false);

  useResetOnOpen(open, () => setChosen(current.map((l) => l.valueId)));

  async function save() {
    setSaving(true);
    try {
      const id = balanceId ?? (await findBalanceId(partId, locationId));
      if (id == null) throw new Error(t("storage.spotSetup.noBalance"));
      const place = await storageService.setStockBalancePlace(id, chosen);
      onSaved(place);
      toast.success(
        place.length > 0
          ? t("storage.spot.savedAt", { part: partName, spot: placeLabel(place) })
          : t("storage.spot.cleared", { part: partName }),
      );
      onOpenChange(false);
    } catch (err) {
      if (!isCancelled(err)) toast.error(err instanceof Error ? err.message : t("common.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 font-heading font-semibold">
            <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {current.length ? t("storage.spotSetup.moveTitle") : t("storage.spotSetup.setTitle")}
          </DialogTitle>
          <DialogDescription>{t("storage.spot.dialogBody", { part: partName, location: locationName })}</DialogDescription>
        </DialogHeader>

        {current.length > 0 && (
          <p className="text-xs text-muted-foreground">{t("storage.spotSetup.now", { spot: placeLabel(current) })}</p>
        )}
        <SpotPicker
          locationId={locationId}
          locationName={locationName}
          value={chosen}
          onChange={setChosen}
          canDeclare={canManage}
          disabled={saving}
          onSetUp={
            onSetUp
              ? (id) => {
                  onOpenChange(false);
                  onSetUp(id);
                }
              : undefined
          }
        />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {t("storage.spot.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The (part, location) balance row's id, for rows that did not carry it. */
export async function findBalanceId(partId: number, locationId: number): Promise<number | null> {
  const res = await storageService.getStockBalances({ part_ids: [partId], storage_location_ids: [locationId], per_page: 1 });
  return res.data[0]?.id ?? null;
}

/**
 * The visible "Set spot" / "Move to spot" button on a part-at-location row.
 * Clicks never reach the row underneath (which opens the part sheet).
 */
export function SpotButton({
  hasSpot,
  locationName,
  onClick,
  className,
}: {
  hasSpot: boolean;
  locationName: string;
  onClick: () => void;
  className?: string;
}) {
  const t = useTranslations("maintenanceSystem");
  const Icon = hasSpot ? MoveRight : MapPinPlus;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-7 gap-1 px-2 text-[11px]", className)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={
        hasSpot
          ? t("storage.spotSetup.moveFor", { location: locationName })
          : t("storage.spotSetup.setFor", { location: locationName })
      }
    >
      <Icon className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" />
      {hasSpot ? t("storage.spotSetup.move") : t("storage.spotSetup.set")}
    </Button>
  );
}
