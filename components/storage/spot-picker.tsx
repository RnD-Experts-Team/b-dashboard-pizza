"use client";

import { useState } from "react";
import { Layers, Loader2, MapPin, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { storageService } from "@/lib/api/services/storage.service";
import { isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { usePlaceLevels } from "@/lib/hooks/use-storage";
import { placeLabel } from "@/lib/storage/stock-forms";
import type { StoragePlaceLevel, StoragePlaceValue } from "@/types/storage.types";

/**
 * Where something sits inside one location: one dropdown per level the
 * location declares (Zone, Shelf, Row…), every level optional. The value is
 * the COMPLETE address as value ids — a level left blank is not part of it.
 *
 * With `canDeclare`, a value that is not on the list yet can be added right
 * here, so putting a part on a brand-new shelf is one flow, not two.
 *
 * A location with no levels yet says so, and — with `onSetUp` — offers the
 * way to the Locations tab where Zone / Shelf are added.
 */

const NONE = "__none__";

export interface SpotPickerProps {
  locationId: number | null;
  value: number[];
  onChange: (valueIds: number[]) => void;
  canDeclare?: boolean;
  disabled?: boolean;
  /** Render nothing (rather than the explanation) when the location has no levels. */
  hideWhenEmpty?: boolean;
  /** The location's name, for the "no zones or shelves yet" explanation. */
  locationName?: string;
  /** Opens the Locations tab on this location, to add its levels. */
  onSetUp?: (locationId: number) => void;
}

export function SpotPicker({ locationId, value, onChange, canDeclare, disabled, hideWhenEmpty, locationName, onSetUp }: SpotPickerProps) {
  const t = useTranslations("maintenanceSystem");
  const { levels: all, isLoading, setData } = usePlaceLevels(locationId);
  const levels = all.filter((l) => !l.deletedAt);

  if (!locationId) return null;
  if (isLoading && levels.length === 0) return <Skeleton className="h-9 w-full" />;
  if (levels.length === 0) {
    if (hideWhenEmpty) return null;
    return <NoLevels locationId={locationId} locationName={locationName} onSetUp={onSetUp} />;
  }

  const chosen = levels.flatMap((level) => {
    const hit = (level.values ?? []).find((v) => value.includes(v.id));
    return hit ? [{ level: level.name, value: hit.value }] : [];
  });

  function choose(level: StoragePlaceLevel, valueId: number | null) {
    const levelValueIds = new Set((level.values ?? []).map((v) => v.id));
    const rest = value.filter((id) => !levelValueIds.has(id));
    onChange(valueId == null ? rest : [...rest, valueId]);
  }

  function declared(level: StoragePlaceLevel, created: StoragePlaceValue) {
    setData((prev) =>
      (prev ?? []).map((l) => (l.id === level.id ? { ...l, values: [...(l.values ?? []), created] } : l)),
    );
    choose(level, created.id);
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {levels.map((level) => (
          <LevelSelect
            key={level.id}
            level={level}
            locationId={locationId}
            selected={(level.values ?? []).find((v) => value.includes(v.id))?.id ?? null}
            onChoose={(id) => choose(level, id)}
            onDeclared={(created) => declared(level, created)}
            canDeclare={canDeclare}
            disabled={disabled}
          />
        ))}
      </div>
      <p className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs" aria-live="polite">
        <MapPin className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        {chosen.length ? placeLabel(chosen) : <span className="text-muted-foreground">{t("storage.spot.notSet")}</span>}
      </p>
    </div>
  );
}

/** The location has no levels: say what that means and where to add them. */
function NoLevels({
  locationId,
  locationName,
  onSetUp,
}: {
  locationId: number;
  locationName?: string;
  onSetUp?: (locationId: number) => void;
}) {
  const t = useTranslations("maintenanceSystem");
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2.5">
      <Layers className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs text-muted-foreground">
          {locationName ? t("storage.spotSetup.noLevelsAt", { location: locationName }) : t("storage.spotSetup.noLevels")}
        </p>
        {onSetUp && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onSetUp(locationId)}>
            <Plus className="me-1 h-3.5 w-3.5" aria-hidden="true" />
            {t("storage.spotSetup.addLevels")}
          </Button>
        )}
      </div>
    </div>
  );
}

function LevelSelect({
  level,
  locationId,
  selected,
  onChoose,
  onDeclared,
  canDeclare,
  disabled,
}: {
  level: StoragePlaceLevel;
  locationId: number;
  selected: number | null;
  onChoose: (valueId: number | null) => void;
  onDeclared: (created: StoragePlaceValue) => void;
  canDeclare?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("maintenanceSystem");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const values = (level.values ?? []).filter((v) => !v.deletedAt);
  const fieldId = `spot-level-${level.id}`;

  async function declare() {
    const next = draft.trim();
    if (!next) return;
    setSaving(true);
    try {
      const created = await storageService.createPlaceValue(locationId, level.id, { value: next, sort_order: values.length });
      onDeclared(created);
      setDraft("");
      setAdding(false);
    } catch (err) {
      if (!isCancelled(err)) toast.error(err instanceof Error ? err.message : t("common.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={fieldId} className="text-xs text-muted-foreground">
        {level.name}
      </Label>
      {adding ? (
        <div className="flex items-center gap-1.5">
          <Input
            id={fieldId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void declare();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            autoFocus
            placeholder={t("storage.spot.newValuePlaceholder", { level: level.name })}
            className="h-9 text-sm"
          />
          <Button type="button" size="sm" className="h-9" onClick={() => void declare()} disabled={saving || !draft.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : t("common.add")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Select
            value={selected != null ? String(selected) : NONE}
            onValueChange={(v) => onChoose(v === NONE ? null : Number(v))}
            disabled={disabled}
          >
            <SelectTrigger id={fieldId} className="h-9 flex-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-60">
              <SelectItem value={NONE}>{t("storage.spot.notSaid")}</SelectItem>
              {values.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canDeclare && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0"
              onClick={() => setAdding(true)}
              disabled={disabled}
              aria-label={t("storage.spot.addValue", { level: level.name })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
