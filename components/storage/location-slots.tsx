"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storageService } from "@/lib/api/services/storage.service";
import { MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";
import type { StorageSlot } from "@/types/storage.types";

/**
 * The named places inside one location.
 *
 * "We know it is in Storage A, but we need to know it is on shelf C, section 5,
 * column Z." A location could not say that; a slot can, and each location names
 * its own -- so a van gets "front rack" and a depot gets "aisle 3 / bay 2"
 * without either being pushed into the other's vocabulary.
 *
 * Free text on purpose. There is no shelf/section/column schema to fill in,
 * because the moment there is, somebody has a place that does not fit it.
 *
 * A SLOT DOES NOT SPLIT THE STOCK COUNT. Quantities stay per location; this
 * records where a part lives so you can walk over and pick it up.
 */

interface LocationSlotsProps {
  locationId: number;
  canManage: boolean;
  className?: string;
}

export function LocationSlots({ locationId, canManage, className }: LocationSlotsProps) {
  const [slots, setSlots] = useState<StorageSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adding, setAdding] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<number | "new" | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      try {
        setSlots(await storageService.getStorageSlots(locationId, signal));
      } catch (err) {
        if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
        toast.error("Could not load the places inside this location.");
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

  async function handleAdd() {
    const name = adding.trim();
    if (!name) return;

    setBusyId("new");
    try {
      // sort_order from the current length, so slots list in the order they
      // were added -- which is usually walking order.
      const slot = await storageService.createStorageSlot(locationId, {
        name,
        sort_order: slots.length,
      });
      setSlots((prev) => [...prev, slot]);
      setAdding("");
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Could not add that."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(slot: StorageSlot) {
    const name = editingName.trim();
    if (!name || name === slot.name) {
      setEditingId(null);
      return;
    }

    setBusyId(slot.id);
    try {
      const updated = await storageService.updateStorageSlot(locationId, slot.id, {
        name,
        sort_order: slot.sortOrder,
      });
      setSlots((prev) => prev.map((s) => (s.id === slot.id ? updated : s)));
      setEditingId(null);
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Could not rename that."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRetire(slot: StorageSlot) {
    setBusyId(slot.id);
    try {
      await storageService.deleteStorageSlot(locationId, slot.id);
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
      // Says what actually happens: the stock does not move.
      toast.success(`${slot.name} retired. Anything recorded there stays where it is.`);
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Could not retire that."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Places inside it
      </p>

      {isLoading && slots.length === 0 && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}

      {!isLoading && slots.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Nothing named yet. Add a shelf, a bay, a drawer — whatever you call it — so parts can
          say where exactly they are.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {slots.map((slot) =>
          editingId === slot.id ? (
            <span key={slot.id} className="inline-flex items-center gap-1">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRename(slot);
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
                className="h-7 w-40 text-xs"
                aria-label={`Rename ${slot.name}`}
              />
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => void handleRename(slot)}
                disabled={busyId === slot.id}
                aria-label="Save"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setEditingId(null)}
                aria-label="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </span>
          ) : (
            <span
              key={slot.id}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs"
            >
              {slot.name}
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(slot.id);
                      setEditingName(slot.name);
                    }}
                    aria-label={`Rename ${slot.name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRetire(slot)}
                    disabled={busyId === slot.id}
                    aria-label={`Retire ${slot.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {busyId === slot.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </>
              )}
            </span>
          )
        )}
      </div>

      {canManage && (
        <div className="flex items-center gap-1.5">
          <Input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAdd();
            }}
            placeholder="Shelf C · Section 5 · Col Z"
            aria-label="Name a new place inside this location"
            className="h-7 max-w-56 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleAdd()}
            disabled={!adding.trim() || busyId === "new"}
            className="h-7"
          >
            {busyId === "new" ? (
              <Loader2 className="me-1 h-3 w-3 animate-spin" />
            ) : (
              <Plus className="me-1 h-3 w-3" />
            )}
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
