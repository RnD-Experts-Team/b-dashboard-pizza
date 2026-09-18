"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocationPlaces } from "./location-places";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { storageService } from "@/lib/api/services/storage.service";
import { entityPaths, MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";
import { getTicketsFieldErrors, isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { EntityNotesAttachments } from "@/components/maintenance-tickets/entity-extras";
import { FieldError } from "@/components/maintenance-tickets/form-bits";
import {
  PaginationBar,
  StorageEmptyState,
  StorageErrorCard,
  StorageSkeleton,
  TBL,
  TD,
  TH,
} from "./storage-shared";
import type {
  StorageErrorState,
  StorageLocation,
  StorageLocationFilters,
  StorageLocationListResponse,
} from "@/types/storage.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Storage locations                                                        */
/*                                                                            */
/*  Soft-deleted, never removed: a retired location keeps its history and its */
/*  balances stay readable. "Delete" therefore retires; it does not erase.    */
/* ────────────────────────────────────────────────────────────────────────── */

function CreateLocationDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setName("");
    setCode("");
    setAddress("");
    setFieldErrors({});
    setFormError(null);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setFieldErrors({ name: "Name is required." });
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await storageService.createStorageLocation({
        name: name.trim(),
        ...(code.trim() ? { code: code.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
      });
      toast.success("Location created.");
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      if (isCancelled(err)) return;
      if (err instanceof MaintenanceTicketsError) {
        const fields = getTicketsFieldErrors(err);
        if (Object.keys(fields).length) setFieldErrors(fields);
        setFormError(err.message);
      }
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Something went wrong."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New storage location</DialogTitle>
          <DialogDescription>
            A shelf, van, or depot that stock can sit in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors({});
              }}
              placeholder="e.g. Main shelf"
              className={cn("h-9 text-sm", fieldErrors.name && "border-destructive")}
              disabled={isSubmitting}
            />
            <FieldError message={fieldErrors.name} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Optional short code"
              className={cn("h-9 text-sm", fieldErrors.code && "border-destructive")}
              disabled={isSubmitting}
            />
            {fieldErrors.code ? (
              <FieldError message={fieldErrors.code} />
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Must be unique among live locations.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Optional"
              className="h-9 text-sm"
              disabled={isSubmitting}
            />
          </div>

          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LocationsTabProps {
  data: StorageLocationListResponse | null;
  isLoading: boolean;
  error: StorageErrorState | null;
  filters: StorageLocationFilters;
  onFiltersChange: (filters: StorageLocationFilters, page?: number) => void;
  canManage: boolean;
  onChanged: () => void;
  className?: string;
}

export function LocationsTab({
  data,
  isLoading,
  error,
  filters,
  onFiltersChange,
  canManage,
  onChanged,
  className,
}: LocationsTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pendingRetire, setPendingRetire] = useState<StorageLocation | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  async function retire(location: StorageLocation) {
    setSaving(location.id);
    try {
      await storageService.deleteStorageLocation(location.id);
      toast.success(`${location.name} retired. Its history and balances are kept.`);
      onChanged();
    } catch (err) {
      if (isCancelled(err)) return;
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(null);
      setPendingRetire(null);
    }
  }

  async function restore(location: StorageLocation) {
    setSaving(location.id);
    try {
      await storageService.restoreStorageLocation(location.id);
      toast.success(`${location.name} restored.`);
      onChanged();
    } catch (err) {
      if (isCancelled(err)) return;
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(null);
    }
  }

  if (isLoading && !data) return <StorageSkeleton />;
  if (error && !data) {
    return <StorageErrorCard error={error} onRetry={() => onFiltersChange(filters, 1)} />;
  }

  const rows = data?.data ?? [];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={filters.trashed === "with"}
            onCheckedChange={(v) =>
              onFiltersChange({ ...filters, trashed: v === true ? "with" : undefined }, 1)
            }
          />
          Show retired locations
        </label>
        {canManage && (
          <Button
            size="sm"
            className="ms-auto h-9 gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New location
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <StorageEmptyState
          title="No storage locations yet"
          description="Create one for each shelf, van or depot that holds stock. Locations are global, not tied to a store."
          action={
            canManage ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="me-1.5 h-3.5 w-3.5" />
                New location
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Name</th>
                  <th className={TH}>Code</th>
                  <th className={TH}>Address</th>
                  <th className={cn(TH, "text-end")}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((location) => {
                  const retired = location.deletedAt != null;
                  return (
                    <>
                      <tr
                        key={location.id}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/40",
                          retired && "opacity-60"
                        )}
                        onClick={() =>
                          setExpanded(expanded === location.id ? null : location.id)
                        }
                      >
                        <td className={TD}>
                          <span
                            className={cn("font-medium", retired && "line-through")}
                          >
                            {location.name}
                          </span>
                          {retired && (
                            <Badge
                              variant="outline"
                              className="ms-1.5 h-4 px-1 text-[9px] font-normal"
                            >
                              Retired
                            </Badge>
                          )}
                        </td>
                        <td className={cn(TD, retired && "line-through")}>
                          {location.code ?? "—"}
                        </td>
                        <td className={cn(TD, retired && "line-through")}>
                          {location.address ?? "—"}
                        </td>
                        <td className={cn(TD, "text-end")}>
                          {canManage && (
                            <div
                              className="flex justify-end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {retired ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={saving === location.id}
                                  onClick={() => restore(location)}
                                >
                                  <RotateCcw className="me-1 h-3 w-3" />
                                  Restore
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                                  disabled={saving === location.id}
                                  onClick={() => setPendingRetire(location)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {expanded === location.id && (
                        <tr key={`${location.id}-detail`}>
                          <td colSpan={4} className="border-t bg-muted/20 p-4">
                            {/* Where inside this location things sit. The whole point of
                                the location row expanding.

                                Two unrelated things live in this cell -- the
                                shelves, and the paperwork -- so there is a rule
                                between them. Stacked flush they read as one
                                block and neither had a beginning. */}
                            <LocationPlaces locationId={location.id} canManage={canManage} />

                            <EntityNotesAttachments
                              className="mt-5 border-t pt-4"
                              entityPath={entityPaths.storageLocation(location.id)}
                              notes={location.notes ?? []}
                              attachments={location.attachments ?? []}
                              onSuccess={onChanged}
                              canAdd={canManage}
                              alwaysOpen
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data && (
            <PaginationBar
              currentPage={data.meta.currentPage}
              lastPage={data.meta.lastPage}
              onPageChange={(page) => onFiltersChange(filters, page)}
              disabled={isLoading}
            />
          )}
        </>
      )}

      <CreateLocationDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={onChanged}
      />

      {/* "Delete" retires rather than erases — say so, or it reads as data loss. */}
      <AlertDialog
        open={pendingRetire !== null}
        onOpenChange={(o) => !o && setPendingRetire(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire {pendingRetire?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops being offered as a destination for new stock. Its movement
              history and its balances are kept and stay readable, and you can restore
              it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRetire && retire(pendingRetire)}
            >
              Retire
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
