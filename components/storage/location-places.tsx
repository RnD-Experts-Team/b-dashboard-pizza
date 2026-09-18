"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Check, Pencil, X, Layers } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storageService } from "@/lib/api/services/storage.service";
import { MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";
import type { StoragePlaceLevel, StoragePlaceValue } from "@/types/storage.types";

/**
 * How this location addresses the space inside it.
 *
 * "We know it is in Storage A, but we need to know it is on shelf C, row 8,
 * column 5." A flat list of names could not say that, so a location now
 * declares its own LEVELS -- Shelf, Row, Column, Section, as many as it wants
 * -- and each level declares the VALUES it can take.
 *
 * Every location declares its own, so a van gets "Rack" and a depot gets
 * "Aisle / Bay / Level" without either being pushed into the other's
 * vocabulary. A part then fills in whichever levels apply and leaves the rest
 * blank.
 *
 * VALUES ARE DECLARED, NOT TYPED. That is the whole reason "what is on Shelf
 * C?" can be asked at all -- otherwise "C", "c" and "Shelf C" become three
 * shelves. The cost of declaring one first is paid back in the picker, which
 * can add a value inline.
 *
 * NONE OF THIS SPLITS THE STOCK COUNT. Quantities stay per (part, location);
 * this records where a part lives so you can walk over and pick it up.
 */

interface LocationPlacesProps {
  locationId: number;
  canManage: boolean;
  className?: string;
}

export function LocationPlaces({ locationId, canManage, className }: LocationPlacesProps) {
  const [levels, setLevels] = useState<StoragePlaceLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingLevel, setAddingLevel] = useState("");
  const [editingLevelId, setEditingLevelId] = useState<number | null>(null);
  const [editingLevelName, setEditingLevelName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

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
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  function fail(err: unknown, fallback: string) {
    if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
    toast.error(err instanceof MaintenanceTicketsError ? err.message : fallback);
  }

  async function addLevel() {
    const name = addingLevel.trim();
    if (!name) return;

    setBusy("new-level");
    try {
      // sort_order from the current length: levels list in the order they were
      // declared, which is the order the address is read in.
      const level = await storageService.createPlaceLevel(locationId, {
        name,
        sort_order: levels.length,
      });
      setLevels((prev) => [...prev, { ...level, values: level.values ?? [] }]);
      setAddingLevel("");
    } catch (err) {
      fail(err, "Could not add that level.");
    } finally {
      setBusy(null);
    }
  }

  async function renameLevel(level: StoragePlaceLevel) {
    const name = editingLevelName.trim();
    if (!name || name === level.name) {
      setEditingLevelId(null);
      return;
    }

    setBusy(`level-${level.id}`);
    try {
      const updated = await storageService.updatePlaceLevel(locationId, level.id, {
        name,
        sort_order: level.sortOrder,
      });
      setLevels((prev) =>
        prev.map((l) => (l.id === level.id ? { ...updated, values: l.values } : l))
      );
      setEditingLevelId(null);
    } catch (err) {
      fail(err, "Could not rename that level.");
    } finally {
      setBusy(null);
    }
  }

  async function retireLevel(level: StoragePlaceLevel) {
    setBusy(`level-${level.id}`);
    try {
      await storageService.deletePlaceLevel(locationId, level.id);
      setLevels((prev) => prev.filter((l) => l.id !== level.id));
      // Says exactly what happened, including the part people worry about.
      toast.success(`${level.name} retired. Nothing moved and no count changed.`);
    } catch (err) {
      fail(err, "Could not retire that level.");
    } finally {
      setBusy(null);
    }
  }

  async function addValue(level: StoragePlaceLevel, raw: string) {
    const value = raw.trim();
    if (!value) return;

    setBusy(`value-new-${level.id}`);
    try {
      const created = await storageService.createPlaceValue(locationId, level.id, {
        value,
        sort_order: level.values?.length ?? 0,
      });
      setLevels((prev) =>
        prev.map((l) => (l.id === level.id ? { ...l, values: [...(l.values ?? []), created] } : l))
      );
    } catch (err) {
      fail(err, "Could not add that.");
    } finally {
      setBusy(null);
    }
  }

  async function retireValue(level: StoragePlaceLevel, value: StoragePlaceValue) {
    setBusy(`value-${value.id}`);
    try {
      await storageService.deletePlaceValue(locationId, level.id, value.id);
      setLevels((prev) =>
        prev.map((l) =>
          l.id === level.id ? { ...l, values: (l.values ?? []).filter((v) => v.id !== value.id) } : l
        )
      );
      toast.success(`${value.value} retired. Anything recorded there keeps its other levels.`);
    } catch (err) {
      fail(err, "Could not retire that.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        How this place is laid out
      </p>

      {isLoading && levels.length === 0 && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}

      {!isLoading && levels.length === 0 && (
        <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
          Nothing laid out yet. Name the levels you use to find things here — Shelf, Row,
          Column, whatever you actually say — then list what each one can be.
        </p>
      )}

      {levels.length > 0 && (
        <div className="space-y-2.5">
          {levels.map((level) => (
            <LevelRow
              key={level.id}
              level={level}
              canManage={canManage}
              busy={busy}
              isEditing={editingLevelId === level.id}
              editingName={editingLevelName}
              onEditingNameChange={setEditingLevelName}
              onStartEditing={() => {
                setEditingLevelId(level.id);
                setEditingLevelName(level.name);
              }}
              onCancelEditing={() => setEditingLevelId(null)}
              onRename={() => void renameLevel(level)}
              onRetire={() => void retireLevel(level)}
              onAddValue={(v) => void addValue(level, v)}
              onRetireValue={(v) => void retireValue(level, v)}
            />
          ))}
        </div>
      )}

      {canManage && (
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={addingLevel}
            onChange={(e) => setAddingLevel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addLevel();
            }}
            placeholder="Shelf · Row · Column · Section"
            aria-label="Name a new level for this location"
            className="h-8 max-w-56 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void addLevel()}
            disabled={!addingLevel.trim() || busy === "new-level"}
            className="h-8"
          >
            {busy === "new-level" ? (
              <Loader2 className="me-1 h-3 w-3 animate-spin" />
            ) : (
              <Plus className="me-1 h-3 w-3" />
            )}
            Add a level
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * One level and everything it can be.
 *
 * The level's name is the heading and its values are chips underneath, so the
 * nesting is visible without an indent guide — "Shelf" and "A B C D" read as
 * one thing rather than two lists that happen to be adjacent.
 */
function LevelRow({
  level,
  canManage,
  busy,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEditing,
  onCancelEditing,
  onRename,
  onRetire,
  onAddValue,
  onRetireValue,
}: {
  level: StoragePlaceLevel;
  canManage: boolean;
  busy: string | null;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (v: string) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onRename: () => void;
  onRetire: () => void;
  onAddValue: (value: string) => void;
  onRetireValue: (value: StoragePlaceValue) => void;
}) {
  const [adding, setAdding] = useState("");
  const values = level.values ?? [];

  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="flex items-center gap-1.5">
        {isEditing ? (
          <>
            <Input
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRename();
                if (e.key === "Escape") onCancelEditing();
              }}
              autoFocus
              className="h-7 w-40 text-xs"
              aria-label={`Rename ${level.name}`}
            />
            <Button size="icon-xs" variant="ghost" onClick={onRename} aria-label="Save">
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={onCancelEditing} aria-label="Cancel">
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <span className="text-xs font-semibold">{level.name}</span>
            <span className="text-[11px] text-muted-foreground">
              {values.length === 0 ? "nothing listed yet" : `${values.length} listed`}
            </span>
            {canManage && (
              <span className="ms-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={onStartEditing}
                  aria-label={`Rename ${level.name}`}
                  className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={onRetire}
                  disabled={busy === `level-${level.id}`}
                  aria-label={`Retire ${level.name}`}
                  className="rounded-sm p-1 text-muted-foreground hover:text-destructive"
                >
                  {busy === `level-${level.id}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </span>
            )}
          </>
        )}
      </div>

      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              key={value.id}
              className="inline-flex h-6 items-center gap-1 rounded-md border bg-background ps-2 pe-1 text-xs"
            >
              <span className="font-medium tabular-nums">{value.value}</span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onRetireValue(value)}
                  disabled={busy === `value-${value.id}`}
                  aria-label={`Retire ${level.name} ${value.value}`}
                  className="rounded-sm text-muted-foreground hover:text-destructive"
                >
                  {busy === `value-${value.id}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {canManage && (
        <div className="mt-2 flex items-center gap-1.5">
          <Input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onAddValue(adding);
                setAdding("");
              }
            }}
            placeholder={`Add a ${level.name.toLowerCase()}…`}
            aria-label={`Add a value to ${level.name}`}
            className="h-7 max-w-40 text-xs"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            disabled={!adding.trim() || busy === `value-new-${level.id}`}
            onClick={() => {
              onAddValue(adding);
              setAdding("");
            }}
          >
            {busy === `value-new-${level.id}` ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
