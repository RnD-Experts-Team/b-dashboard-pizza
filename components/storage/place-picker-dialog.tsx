"use client";

import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
 * stock-balances/{id}/place). The count is never touched.
 */

interface PlacePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The (part, location) balance row being addressed. */
  balanceId: number;
  locationId: number;
  locationName: string;
  partName: string;
  current: StockPlaceLine[];
  canManage: boolean;
  onSaved: (place: StockPlaceLine[]) => void;
}

export function PlacePickerDialog({
  open,
  onOpenChange,
  balanceId,
  locationId,
  locationName,
  partName,
  current,
  canManage,
  onSaved,
}: PlacePickerDialogProps) {
  const t = useTranslations("maintenanceSystem");
  const [chosen, setChosen] = useState<number[]>(() => current.map((l) => l.valueId));
  const [saving, setSaving] = useState(false);

  useResetOnOpen(open, () => setChosen(current.map((l) => l.valueId)));

  async function save() {
    setSaving(true);
    try {
      const place = await storageService.setStockBalancePlace(balanceId, chosen);
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
            {t("storage.spot.dialogTitle")}
          </DialogTitle>
          <DialogDescription>{t("storage.spot.dialogBody", { part: partName, location: locationName })}</DialogDescription>
        </DialogHeader>

        <SpotPicker locationId={locationId} value={chosen} onChange={setChosen} canDeclare={canManage} disabled={saving} />

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
