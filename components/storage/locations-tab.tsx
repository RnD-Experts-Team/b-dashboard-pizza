"use client";

import { useEffect, useState } from "react";
import { Archive, ChevronRight, Loader2, MapPinned, Plus, RotateCcw, Warehouse } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/maintenance-tickets/form-bits";
import { storageService } from "@/lib/api/services/storage.service";
import { getTicketsFieldErrors, isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { useDiscardGuard, useResetOnOpen } from "./discard-guard";
import { LocationPlaces } from "./location-places";
import { StorageEmptyState, StorageErrorState, StorageSkeleton } from "./storage-shared";
import type { StorageLocation } from "@/types/storage.types";

/**
 * Locations: where we keep things (a store room, a van, a depot) and, for the
 * selected one, its spot editor. Retiring a location keeps its history and
 * its stock readable; it can be brought back.
 */

export interface LocationsTabProps {
  locations: readonly StorageLocation[];
  isLoading: boolean;
  error: { message: string } | null;
  onRetry: () => void;
  selectedId?: number;
  onSelect: (id: number | null) => void;
  canManage: boolean;
  onChanged: () => void;
}

export function LocationsTab({ locations, isLoading, error, onRetry, selectedId, onSelect, canManage, onChanged }: LocationsTabProps) {
  const t = useTranslations("maintenanceSystem");
  const [adding, setAdding] = useState(false);
  const [retiring, setRetiring] = useState<StorageLocation | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const selected = locations.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    // Open the first live location when nothing is picked yet.
    if (!selectedId && locations.length) onSelect(locations.find((l) => !l.deletedAt)?.id ?? null);
  }, [selectedId, locations, onSelect]);

  async function retire(location: StorageLocation) {
    setBusyId(location.id);
    try {
      await storageService.deleteStorageLocation(location.id);
      toast.success(t("storage.locations.retired", { name: location.name }));
      setRetiring(null);
      onChanged();
    } catch (err) {
      if (!isCancelled(err)) toast.error(err instanceof Error ? err.message : t("common.saveError"));
    } finally {
      setBusyId(null);
    }
  }

  async function restore(location: StorageLocation) {
    setBusyId(location.id);
    try {
      await storageService.restoreStorageLocation(location.id);
      toast.success(t("storage.locations.restored", { name: location.name }));
      onChanged();
    } catch (err) {
      if (!isCancelled(err)) toast.error(err instanceof Error ? err.message : t("common.saveError"));
    } finally {
      setBusyId(null);
    }
  }

  const addButton = canManage ? (
    <Button onClick={() => setAdding(true)}>
      <Plus className="me-1.5 h-4 w-4" aria-hidden="true" />
      {t("storage.locations.add")}
    </Button>
  ) : null;

  if (error && locations.length === 0) return <StorageErrorState message={error.message} onRetry={onRetry} />;
  if (isLoading && locations.length === 0) return <StorageSkeleton rows={4} />;

  return (
    <div className="space-y-3">
      {locations.length === 0 ? (
        <StorageEmptyState icon={Warehouse} description={t("storage.locations.empty")} action={addButton} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t("storage.locations.help")}</p>
              {addButton}
            </div>
            <ul className="space-y-1.5">
              {locations.map((location) => {
                const active = location.id === selectedId;
                const retired = Boolean(location.deletedAt);
                return (
                  <li key={location.id}>
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-md border bg-card p-2.5 transition-colors",
                        active ? "border-primary/60 bg-primary/5" : "hover:bg-muted/40",
                        retired && "opacity-70",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(location.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-start"
                        aria-current={active ? "true" : undefined}
                      >
                        <Warehouse className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{location.name}</span>
                            {location.code && <span className="text-[11px] text-muted-foreground">{location.code}</span>}
                          </span>
                          {location.address && <span className="block truncate text-[11px] text-muted-foreground">{location.address}</span>}
                        </span>
                        {retired && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            {t("storage.locations.retiredBadge")}
                          </Badge>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
                      </button>
                      {canManage &&
                        (retired ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => void restore(location)}
                            disabled={busyId === location.id}
                            aria-label={t("storage.locations.restore", { name: location.name })}
                          >
                            {busyId === location.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setRetiring(location)}
                            aria-label={t("storage.locations.retire", { name: location.name })}
                          >
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            {selected ? (
              <LocationPlaces key={selected.id} locationId={selected.id} locationName={selected.name} canManage={canManage && !selected.deletedAt} />
            ) : (
              <StorageEmptyState icon={MapPinned} description={t("storage.locations.pickOne")} />
            )}
          </div>
        </div>
      )}

      <CreateLocationDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={(location) => {
          onChanged();
          onSelect(location.id);
        }}
      />

      <AlertDialog open={retiring != null} onOpenChange={(o) => !o && busyId == null && setRetiring(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-semibold">
              {t("storage.locations.retireTitle", { name: retiring?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("storage.locations.retireBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busyId != null}
              onClick={(e) => {
                e.preventDefault();
                if (retiring) void retire(retiring);
              }}
            >
              {busyId != null && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {t("storage.locations.retireConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateLocationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (location: StorageLocation) => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const guard = useDiscardGuard(Boolean(name || code || address) && !saving, () => onOpenChange(false));

  useResetOnOpen(open, () => {
    setName("");
    setCode("");
    setAddress("");
    setErrors({});
  });

  async function submit() {
    if (!name.trim()) {
      setErrors({ name: t("storage.locations.nameRequired") });
      return;
    }
    setSaving(true);
    try {
      const created = await storageService.createStorageLocation({
        name: name.trim(),
        ...(code.trim() ? { code: code.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
      });
      toast.success(t("storage.locations.created", { name: created.name }));
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      if (isCancelled(err)) return;
      const fields = getTicketsFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      else toast.error(err instanceof Error ? err.message : t("common.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : guard.requestClose())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading font-semibold">{t("storage.locations.add")}</DialogTitle>
            <DialogDescription>{t("storage.locations.addHelp")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="loc-name">
                {t("common.name")} <span className="text-destructive">*</span>
              </Label>
              <Input id="loc-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} autoFocus />
              <FieldError message={errors.name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-code">
                {t("storage.locations.code")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input id="loc-code" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-40" />
              <p className="text-[11px] text-muted-foreground">{t("storage.locations.codeHelp")}</p>
              <FieldError message={errors.code} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-address">
                {t("storage.locations.address")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input id="loc-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              <FieldError message={errors.address} />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={guard.requestClose} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {t("storage.locations.add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}
