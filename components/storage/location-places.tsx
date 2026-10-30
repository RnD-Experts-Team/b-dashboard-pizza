"use client";

import { useState } from "react";
import { Check, Layers, Loader2, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { storageService } from "@/lib/api/services/storage.service";
import { isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { usePlaceLevels } from "@/lib/hooks/use-storage";
import { placeLabel } from "@/lib/storage/stock-forms";
import { StorageEmptyState } from "./storage-shared";
import type { StoragePlaceLevel, StoragePlaceValue } from "@/types/storage.types";

/**
 * The spot editor for one location. A location lays out its own LEVELS,
 * biggest first (Zone → Shelf → Bin), and each level its VALUES (Zone A, B…;
 * Shelf S, T…). A part's spot is then one value per level, any level
 * optional: "Zone A › Shelf S". Values are declared, never typed freehand,
 * so "C", "c" and "Shelf C" cannot become three shelves.
 *
 * Spots never split the count: quantities stay per (part, location).
 */

/**
 * Separators for adding several values at once ("A, B, C" or one per line).
 * https://regex101.com/?flavor=javascript&regex=%5B%2C%5Cn%5D&flags=g&testString=A%2C%20B%0AC
 */
const VALUE_SEPARATORS = /[,\n]/;

type Pending = { kind: "level"; level: StoragePlaceLevel } | { kind: "value"; level: StoragePlaceLevel; value: StoragePlaceValue };

export function LocationPlaces({ locationId, locationName, canManage }: { locationId: number; locationName: string; canManage: boolean }) {
  const t = useTranslations("maintenanceV2");
  const { levels, isLoading, error, refresh, setData } = usePlaceLevels(locationId);
  const [newLevel, setNewLevel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const live = levels.filter((l) => !l.deletedAt);
  const example = placeLabel(
    live
      .map((l) => ({ level: l.name, value: (l.values ?? []).find((v) => !v.deletedAt)?.value ?? "" }))
      .filter((line) => line.value),
  );

  function fail(err: unknown) {
    if (!isCancelled(err)) toast.error(err instanceof Error ? err.message : t("common.saveError"));
  }

  function replaceLevel(id: number, fn: (level: StoragePlaceLevel) => StoragePlaceLevel) {
    setData((prev) => (prev ?? []).map((l) => (l.id === id ? fn(l) : l)));
  }

  async function addLevel() {
    const name = newLevel.trim();
    if (!name) return;
    setBusy("new-level");
    try {
      const created = await storageService.createPlaceLevel(locationId, { name, sort_order: live.length });
      setData((prev) => [...(prev ?? []), { ...created, values: created.values ?? [] }]);
      setNewLevel("");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!pending) return;
    setBusy("delete");
    try {
      if (pending.kind === "level") {
        await storageService.deletePlaceLevel(locationId, pending.level.id);
        setData((prev) => (prev ?? []).filter((l) => l.id !== pending.level.id));
      } else {
        await storageService.deletePlaceValue(locationId, pending.level.id, pending.value.id);
        replaceLevel(pending.level.id, (l) => ({ ...l, values: (l.values ?? []).filter((v) => v.id !== pending.value.id) }));
      }
      toast.success(t("storage.places.removed"));
      setPending(null);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  if (isLoading && levels.length === 0) return <Skeleton className="h-40 w-full" />;
  if (error && levels.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        {error.message}
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="flex items-center gap-1.5 font-heading text-base font-semibold">
          <Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {t("storage.places.title", { location: locationName })}
        </h3>
        <p className="text-sm text-muted-foreground">{t("storage.places.help")}</p>
        {example && (
          <p className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
            <MapPin className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            {t("storage.places.example", { spot: example })}
          </p>
        )}
      </div>

      {live.length === 0 && (
        <StorageEmptyState icon={Layers} description={canManage ? t("storage.places.emptyManage") : t("storage.places.empty")} />
      )}

      <ol className="space-y-3">
        {live.map((level, index) => (
          <LevelCard
            key={level.id}
            index={index}
            level={level}
            locationId={locationId}
            canManage={canManage}
            onChanged={(next) => replaceLevel(level.id, () => next)}
            onDeleteLevel={() => setPending({ kind: "level", level })}
            onDeleteValue={(value) => setPending({ kind: "value", level, value })}
            onError={fail}
          />
        ))}
      </ol>

      {canManage && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addLevel();
          }}
        >
          <Input
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value)}
            placeholder={live.length ? t("storage.places.nextLevelPlaceholder") : t("storage.places.firstLevelPlaceholder")}
            aria-label={t("storage.places.addLevel")}
            className="h-9 max-w-xs"
          />
          <Button type="submit" variant="outline" size="sm" className="h-9" disabled={!newLevel.trim() || busy === "new-level"}>
            {busy === "new-level" ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />}
            {t("storage.places.addLevel")}
          </Button>
        </form>
      )}

      <AlertDialog open={pending != null} onOpenChange={(o) => !o && busy !== "delete" && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-semibold">
              {pending?.kind === "level"
                ? t("storage.places.removeLevelTitle", { level: pending.level.name })
                : t("storage.places.removeValueTitle", { value: pending ? placeLabel([{ level: pending.level.name, value: pending.kind === "value" ? pending.value.value : "" }]) : "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "level" ? t("storage.places.removeLevelBody") : t("storage.places.removeValueBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "delete"}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busy === "delete"}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {busy === "delete" && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LevelCard({
  index,
  level,
  locationId,
  canManage,
  onChanged,
  onDeleteLevel,
  onDeleteValue,
  onError,
}: {
  index: number;
  level: StoragePlaceLevel;
  locationId: number;
  canManage: boolean;
  onChanged: (level: StoragePlaceLevel) => void;
  onDeleteLevel: () => void;
  onDeleteValue: (value: StoragePlaceValue) => void;
  onError: (err: unknown) => void;
}) {
  const t = useTranslations("maintenanceV2");
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(level.name);
  const [newValues, setNewValues] = useState("");
  const [saving, setSaving] = useState(false);
  const values = (level.values ?? []).filter((v) => !v.deletedAt);

  async function rename() {
    const next = name.trim();
    if (!next || next === level.name) {
      setRenaming(false);
      return;
    }
    setSaving(true);
    try {
      const saved = await storageService.updatePlaceLevel(locationId, level.id, { name: next, sort_order: level.sortOrder });
      onChanged({ ...level, name: saved.name });
      setRenaming(false);
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  }

  async function addValues() {
    const known = new Set(values.map((v) => v.value.trim().toLowerCase()));
    const wanted = [...new Set(newValues.split(VALUE_SEPARATORS).map((v) => v.trim()).filter(Boolean))].filter(
      (v) => !known.has(v.toLowerCase()),
    );
    if (!wanted.length) {
      setNewValues("");
      return;
    }
    setSaving(true);
    const created: StoragePlaceValue[] = [];
    try {
      // One after another, so their order is the order they were typed in.
      await wanted.reduce<Promise<void>>(async (previous, value, i) => {
        await previous;
        created.push(await storageService.createPlaceValue(locationId, level.id, { value, sort_order: values.length + i }));
      }, Promise.resolve());
      setNewValues("");
    } catch (err) {
      onError(err);
    } finally {
      if (created.length) onChanged({ ...level, values: [...(level.values ?? []), ...created] });
      setSaving(false);
    }
  }

  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums">
          {index + 1}
        </span>
        {renaming ? (
          <form
            className="flex flex-1 items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void rename();
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 max-w-56 text-sm" autoFocus aria-label={t("storage.places.levelName")} />
            <Button type="submit" size="icon" variant="ghost" className="h-7 w-7" disabled={saving} aria-label={t("common.save")}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setName(level.name);
                setRenaming(false);
              }}
              aria-label={t("common.cancel")}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </form>
        ) : (
          <p className="flex-1 text-sm font-semibold">{level.name}</p>
        )}
        {canManage && !renaming && (
          <>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRenaming(true)} aria-label={t("storage.places.renameLevel", { level: level.name })}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDeleteLevel} aria-label={t("storage.places.removeLevel", { level: level.name })}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 ps-7">
        {values.length === 0 && <span className="text-xs text-muted-foreground">{t("storage.places.noValues")}</span>}
        {values.map((v) => (
          <span key={v.id} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
            {v.value}
            {canManage && (
              <button
                type="button"
                className="rounded-full text-muted-foreground hover:text-destructive"
                onClick={() => onDeleteValue(v)}
                aria-label={t("storage.places.removeValue", { value: `${level.name} ${v.value}` })}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
      </div>

      {canManage && (
        <form
          className="mt-2 flex items-center gap-1.5 ps-7"
          onSubmit={(e) => {
            e.preventDefault();
            void addValues();
          }}
        >
          <Input
            value={newValues}
            onChange={(e) => setNewValues(e.target.value)}
            placeholder={t("storage.places.valuesPlaceholder", { level: level.name })}
            aria-label={t("storage.places.addValues", { level: level.name })}
            className="h-8 max-w-xs text-sm"
          />
          <Button type="submit" size="sm" variant="outline" className="h-8" disabled={saving || !newValues.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : t("common.add")}
          </Button>
        </form>
      )}
    </li>
  );
}
