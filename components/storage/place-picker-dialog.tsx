"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { storageService } from "@/lib/api/services/storage.service";
import { MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";
import type {
  StockPlaceLine,
  StoragePlaceLevel,
  StoragePlaceValue,
} from "@/types/storage.types";

/**
 * Say where a part sits inside a location.
 *
 * THIS IS THE CONTROL THAT DID NOT EXIST. The previous version could name
 * shelves and could display a shelf the server sent back, and there was no way
 * anywhere in the app to put a part on one — so the display branch that said
 * "shelf not recorded" was the only branch a real balance could ever take.
 *
 * One dropdown per level the location declares, each with a blank option,
 * because every level is optional and a part that lives in a column and nothing
 * else has to be able to say that. Saving sends the COMPLETE address: a level
 * left blank is cleared, which is why this is a PUT upstream.
 *
 * A NEW VALUE CAN BE DECLARED HERE. Declaring values up front is what makes
 * "what is on Shelf C?" answerable, but it would be a miserable trade if
 * putting something on a brand-new shelf meant leaving this screen, going to
 * the location settings, and coming back.
 */

const NONE = "__none__";

interface PlacePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The (part, location) row being addressed. */
  balanceId: number;
  locationId: number;
  locationName: string;
  partName: string;
  /** What it says now, so the dropdowns open on the current answer. */
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
  const [levels, setLevels] = useState<StoragePlaceLevel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  /** levelId -> valueId, or absent for "not said". */
  const [chosen, setChosen] = useState<Record<number, number>>({});

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      try {
        setLevels(await storageService.getPlaceLevels(locationId, signal));
      } catch (err) {
        if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
        toast.error("Could not load how this location is laid out.");
      } finally {
        setIsLoading(false);
      }
    },
    [locationId]
  );

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    void load(ctrl.signal);
    // Seed from what is already recorded, so opening this never looks like
    // starting over.
    setChosen(Object.fromEntries(current.map((l) => [l.levelId, l.valueId])));
    return () => ctrl.abort();
  }, [open, load, current]);

  async function save() {
    setIsSaving(true);
    try {
      const place = await storageService.setStockBalancePlace(
        balanceId,
        Object.values(chosen)
      );
      onSaved(place);
      toast.success(
        place.length > 0
          ? `${partName} is on ${place.map((l) => l.value).join(" · ")}.`
          : `Cleared where ${partName} is. Its count is unchanged.`
      );
      onOpenChange(false);
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Could not save that."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Where is it?
          </DialogTitle>
          <DialogDescription>
            {partName} in {locationName}. Fill in what you know — every level is optional.
          </DialogDescription>
        </DialogHeader>

        {isLoading && levels.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading the levels…
          </div>
        ) : levels.length === 0 ? (
          <p className="py-4 text-sm leading-relaxed text-muted-foreground">
            {locationName} has no levels laid out yet. Add them under{" "}
            <span className="font-medium text-foreground">Where we keep things</span> — name
            what you actually say, like Shelf, Row or Column — and then come back.
          </p>
        ) : (
          <div className="space-y-4 py-1">
            {levels.map((level) => (
              <LevelField
                key={level.id}
                level={level}
                locationId={locationId}
                canManage={canManage}
                value={chosen[level.id]}
                onChange={(valueId) =>
                  setChosen((prev) => {
                    const next = { ...prev };
                    // Absent, not null: "not said" is the absence of an answer,
                    // and sending nothing is how the API is told to clear it.
                    if (valueId == null) delete next[level.id];
                    else next[level.id] = valueId;
                    return next;
                  })
                }
                onValueDeclared={(created) =>
                  setLevels((prev) =>
                    prev.map((l) =>
                      l.id === level.id ? { ...l, values: [...(l.values ?? []), created] } : l
                    )
                  )
                }
              />
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={isSaving || levels.length === 0}>
            {isSaving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
            Save where it is
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LevelField({
  level,
  locationId,
  canManage,
  value,
  onChange,
  onValueDeclared,
}: {
  level: StoragePlaceLevel;
  locationId: number;
  canManage: boolean;
  value: number | undefined;
  onChange: (valueId: number | null) => void;
  onValueDeclared: (created: StoragePlaceValue) => void;
}) {
  const [declaring, setDeclaring] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const values = level.values ?? [];

  async function declare() {
    const next = draft.trim();
    if (!next) return;

    setIsSaving(true);
    try {
      const created = await storageService.createPlaceValue(locationId, level.id, {
        value: next,
        sort_order: values.length,
      });
      onValueDeclared(created);
      // Selecting it too: you added it because that is where the part is.
      onChange(created.id);
      setDraft("");
      setDeclaring(false);
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Could not add that."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{level.name}</Label>

      {declaring ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void declare();
              if (e.key === "Escape") setDeclaring(false);
            }}
            autoFocus
            placeholder={`New ${level.name.toLowerCase()}…`}
            aria-label={`New value for ${level.name}`}
            className="h-9 text-sm"
          />
          <Button size="sm" className="h-9" onClick={() => void declare()} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9"
            onClick={() => setDeclaring(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Select
            value={value != null ? String(value) : NONE}
            onValueChange={(v) => onChange(v === NONE ? null : Number(v))}
          >
            <SelectTrigger className="h-9 flex-1 text-sm">
              <SelectValue placeholder="Not said" />
            </SelectTrigger>
            <SelectContent position="popper" style={{ maxHeight: 240, overflowY: "auto" }}>
              {/* Blank is a real answer, not a missing one. */}
              <SelectItem value={NONE}>Not said</SelectItem>
              {values.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canManage && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 shrink-0"
              onClick={() => setDeclaring(true)}
              title={`Add a ${level.name.toLowerCase()} that is not on the list yet`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
