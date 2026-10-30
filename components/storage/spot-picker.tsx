"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
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
import type { StoragePlaceLevel, StoragePlaceValue } from "@/types/storage.types";

/**
 * Where something sits inside one location: one dropdown per level the
 * location declares (Zone, Shelf, Row…), every level optional. The value is
 * the COMPLETE address as value ids — a level left blank is not part of it.
 *
 * With `canDeclare`, a value that is not on the list yet can be added right
 * here, so putting a part on a brand-new shelf is one flow, not two.
 */

const NONE = "__none__";

export interface SpotPickerProps {
  locationId: number | null;
  value: number[];
  onChange: (valueIds: number[]) => void;
  canDeclare?: boolean;
  disabled?: boolean;
  /** Shown when the location has no levels laid out. */
  hideWhenEmpty?: boolean;
}

export function SpotPicker({ locationId, value, onChange, canDeclare, disabled, hideWhenEmpty }: SpotPickerProps) {
  const t = useTranslations("maintenanceV2");
  const { levels, isLoading, setData } = usePlaceLevels(locationId);

  if (!locationId) return null;
  if (isLoading && levels.length === 0) return <Skeleton className="h-9 w-full" />;
  if (levels.length === 0) {
    return hideWhenEmpty ? null : <p className="text-xs text-muted-foreground">{t("storage.spot.noLevels")}</p>;
  }

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
  const t = useTranslations("maintenanceV2");
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
