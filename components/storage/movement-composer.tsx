"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Calculator,
  Loader2,
  PackageMinus,
  PackagePlus,
  Plus,
  Trash2,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STOCK_ACTIONS, type StockActionId } from "@/lib/storage/stock-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { storageService } from "@/lib/api/services/storage.service";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import {
  getTicketsFieldErrors,
  isCancelled,
  readStockShortfall,
  type StockShortfallContext,
} from "@/lib/api/maintenance-tickets-errors";
import {
  FIXED_DIRECTION,
  directionLabel,
  isTransferType,
} from "@/lib/storage/movement-types";
import {
  buildMovementRequests,
  emptyComposerForm,
  emptyRow,
  previewNetByLocation,
  resolveLineError,
  rowErrorKey,
  validateComposer,
  type ComposerForm,
  type ComposerRow,
} from "@/lib/storage/movement-builder";
import { DateTimePicker, FieldError, Segmented } from "@/components/maintenance-tickets/form-bits";
import { SearchCreateCombobox } from "@/components/maintenance-tickets/search-create-combobox";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/shared/searchable-select";
import type { CatalogPart, CatalogTechnician } from "@/types/maintenance-tickets.types";
import type {
  PostableStockMovementType,
  StockDirection,
  StockPaidBy,
  StorageLocation,
} from "@/types/storage.types";

/** Icons for the plain-language actions. Kept here rather than in
 *  lib/storage/stock-actions.ts so that module stays free of React. */
const STOCK_ACTION_ICONS: Record<StockActionId, LucideIcon> = {
  received: PackagePlus,
  usedOnJob: PackageMinus,
  cameBack: Undo2,
  movedBetween: ArrowLeftRight,
  fixCount: Calculator,
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Record a stock movement                                                  */
/*                                                                            */
/*  One movement is one BATCH: several parts, their amounts, where they are,  */
/*  who paid.                                                                */
/*                                                                            */
/*  `reversal` is absent from the type list AND unrepresentable in the form   */
/*  state, because the action list is derived from a Record keyed by           */
/*  PostableStockMovementType, which excludes it.                            */
/* ────────────────────────────────────────────────────────────────────────── */

function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface MovementComposerProps {
  open: boolean;
  parts: CatalogPart[];
  /** Live only — retired locations must not receive new stock. */
  locations: StorageLocation[];
  onClose: () => void;
  onSuccess: () => void;
}

export function MovementComposer({
  open,
  parts,
  locations,
  onClose,
  onSuccess,
}: MovementComposerProps) {
  const [form, setForm] = useState<ComposerForm>(() => emptyComposerForm(localNow()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<StockShortfallContext | null>(null);
  const [technicians, setTechnicians] = useState<CatalogTechnician[]>([]);
  const [onHand, setOnHand] = useState<Map<string, number>>(new Map());
  const rowSeq = useRef(1);

  const fixed = FIXED_DIRECTION[form.type];
  const transfer = isTransferType(form.type);

  useEffect(() => {
    if (!open) return;
    setForm(emptyComposerForm(localNow()));
    setErrors({});
    setFormError(null);
    setShortfall(null);
    setOnHand(new Map());
    rowSeq.current = 1;
  }, [open]);

  useEffect(() => {
    if (!open || form.paidBy !== "technician" || technicians.length > 0) return;
    const ctrl = new AbortController();
    maintenanceTicketsService
      .getCatalogTechnicians(ctrl.signal)
      .then((rows) => setTechnicians(rows.filter((t) => !t.deletedAt)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [open, form.paidBy, technicians.length]);

  /* ── On-hand hints for outbound lines ─────────────────────────────────── */

  const built = useMemo(() => buildMovementRequests(form), [form]);
  const technicianOptions = useMemo<SearchableSelectOption[]>(
    () => technicians.map((t) => ({ value: String(t.id), label: t.name })),
    [technicians]
  );

  useEffect(() => {
    if (!open) return;
    const outbound = (built.payloads[0]?.lines ?? []).filter((l) => l.direction === -1);
    const wanted = Array.from(
      new Set(outbound.map((l) => `${l.part_id}:${l.storage_location_id}`))
    ).filter((key) => !onHand.has(key));
    if (wanted.length === 0) return;

    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      for (const key of wanted) {
        const [partId, locationId] = key.split(":").map(Number);
        storageService
          .getOnHand(partId, locationId, ctrl.signal)
          .then((value) => {
            if (ctrl.signal.aborted || value == null) return;
            setOnHand((prev) => new Map(prev).set(key, value));
          })
          // A failed hint renders NOTHING. Never show 0 for "we don't know".
          .catch(() => {});
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, built]);

  const netByLocation = useMemo(() => previewNetByLocation(built), [built]);

  /* ── Mutators ─────────────────────────────────────────────────────────── */

  function patch(next: Partial<ComposerForm>) {
    setForm((prev) => ({ ...prev, ...next }));
    setErrors({});
    setFormError(null);
    setShortfall(null);
  }

  function patchRow(rowId: string, next: Partial<ComposerRow>) {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.rowId === rowId ? { ...r, ...next } : r)),
    }));
    setErrors({});
    setFormError(null);
    setShortfall(null);
  }

  function changeType(type: PostableStockMovementType) {
    // Clear per-line directions: a choice made under `adjustment` must never
    // ride along into a type that fixes its own direction.
    patch({
      type,
      rows: form.rows.map((r) => ({ ...r, direction: null })),
      ...(isTransferType(type) ? {} : { fromLocationId: "", toLocationId: "" }),
    });
  }

  async function createPart(name: string): Promise<number> {
    const created = await maintenanceTicketsService.createCatalogPart({ name });
    return created.id;
  }

  /* ── Submit ───────────────────────────────────────────────────────────── */

  async function handleSubmit() {
    const validation = validateComposer(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setShortfall(null);
    try {
      // One payload today. If the backend turns out to need two movements for
      // a transfer, buildMovementRequests returns two and this loop covers it.
      for (const payload of built.payloads) {
        await storageService.createStockMovement(payload);
      }
      toast.success("Movement recorded.");
      onSuccess();
      onClose();
    } catch (err) {
      if (isCancelled(err)) return;

      if (err instanceof MaintenanceTicketsError) {
        const short = readStockShortfall(err);
        if (short) {
          setShortfall(short);
          setFormError(err.message);
          // NOTHING resets on failure. A movement can be a dozen lines of
          // typing, and nothing was created upstream.
          return;
        }

        const fields = getTicketsFieldErrors(err);
        const mapped: Record<string, string> = {};
        for (const [key, message] of Object.entries(fields)) {
          const resolved = resolveLineError(key, built);
          if (resolved) {
            mapped[rowErrorKey(resolved.origin.rowId, resolved.field)] = message;
          } else {
            // Unmappable keys surface at form level rather than vanishing.
            mapped[key] = message;
          }
        }
        if (Object.keys(mapped).length) setErrors(mapped);
        setFormError(err.message);
      }

      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Something went wrong."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  const locationName = (id: number) =>
    locations.find((l) => l.id === id)?.name ?? `Location #${id}`;
  const partName = (id: number) => parts.find((p) => p.id === id)?.name ?? `Part #${id}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Record a stock movement</DialogTitle>
          <DialogDescription>
            One movement covers several parts at once. Nothing is ever edited or
            deleted afterwards — a mistake is corrected by a reversal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                When <span className="text-destructive">*</span>
              </Label>
              <DateTimePicker
                value={form.movedAt}
                onChange={(v) => patch({ movedAt: v })}
                disabled={isSubmitting}
              />
              <FieldError message={errors.moved_at} />
            </div>

            {/*
              WHAT HAPPENED, in the words a person would use.

              This was a dropdown of seven enum values -- purchase, draw,
              return, transfer_in, transfer_out, adjustment, initial_count --
              plus, for adjustments, a separate +1/-1 direction control that was
              the most confusing thing on the page. Nobody walks into a store
              room thinking "transfer_out".

              The five buttons map one-to-one onto those types. The vocabulary
              underneath is unchanged and `lib/storage/movement-types.ts` is
              still the only place a direction is decided -- this just stops the
              jargon reaching the screen.
            */}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">
                What happened <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {STOCK_ACTIONS.map((action) => {
                  const Icon = STOCK_ACTION_ICONS[action.id];
                  const isActive = action.movementType === form.type;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      disabled={isSubmitting}
                      aria-pressed={isActive}
                      onClick={() =>
                        action.movementType &&
                        changeType(action.movementType as PostableStockMovementType)
                      }
                      className={cn(
                        "flex h-full flex-col items-start gap-0.5 rounded-lg border p-2.5 text-start transition-colors",
                        isActive
                          ? "border-primary bg-primary/10"
                          : "bg-card hover:border-primary/50 hover:bg-accent",
                        isSubmitting && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        {action.label}
                      </span>
                      <span className="text-[11px] leading-snug text-muted-foreground">
                        {action.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Who paid</Label>
              <Segmented<StockPaidBy>
                value={form.paidBy}
                options={[
                  { value: "us", label: "Us" },
                  { value: "technician", label: "Technician" },
                ]}
                onChange={(v) => patch({ paidBy: v })}
                disabled={isSubmitting}
              />
            </div>

            {form.paidBy === "technician" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Paid by <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  options={technicianOptions}
                  value={form.paidByTechnicianId || undefined}
                  onChange={(v) => patch({ paidByTechnicianId: v })}
                  disabled={isSubmitting}
                  placeholder="Select technician"
                  searchPlaceholder="Search technicians…"
                  emptyText="No technicians found."
                  className={cn(
                    "h-9 text-sm",
                    errors.paid_by_technician_id && "border-destructive"
                  )}
                />
                <FieldError message={errors.paid_by_technician_id} />
              </div>
            )}
          </div>

          {/* Transfer: locations move to the header, one movement two sides */}
          {transfer && (
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  From <span className="text-destructive">*</span>
                </Label>
                <LocationSelect
                  value={form.fromLocationId}
                  locations={locations}
                  onChange={(v) => patch({ fromLocationId: v })}
                  invalid={!!errors.from_location}
                  disabled={isSubmitting}
                />
                <FieldError message={errors.from_location} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  To <span className="text-destructive">*</span>
                </Label>
                <LocationSelect
                  value={form.toLocationId}
                  locations={locations}
                  onChange={(v) => patch({ toLocationId: v })}
                  invalid={!!errors.to_location}
                  disabled={isSubmitting}
                />
                <FieldError message={errors.to_location} />
              </div>
            </div>
          )}

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Parts ({form.rows.length})
              </p>
              {fixed != null && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  Every line {directionLabel(fixed)}
                </Badge>
              )}
            </div>

            <FieldError message={errors.lines} />

            {form.rows.map((row) => {
              const key = `${row.partId}:${transfer ? form.fromLocationId : row.storageLocationId}`;
              const hint = onHand.get(key);
              const qty = Number(row.quantity);
              const outbound =
                transfer || (fixed ?? row.direction) === -1;
              const over =
                outbound && hint != null && Number.isFinite(qty) && qty > hint;

              return (
                <div key={row.rowId} className="space-y-2 rounded-md border bg-muted/20 p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Part</Label>
                      <SearchCreateCombobox
                        items={parts.map((p) => ({ id: p.id, label: p.name }))}
                        selectedId={row.partId ? Number(row.partId) : null}
                        onSelect={(id) =>
                          patchRow(row.rowId, { partId: id != null ? String(id) : "" })
                        }
                        onCreate={createPart}
                        placeholder="Search parts…"
                      />
                      <FieldError message={errors[rowErrorKey(row.rowId, "part")]} />
                    </div>
                    {form.rows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-5 h-7 px-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          patch({ rows: form.rows.filter((r) => r.rowId !== row.rowId) })
                        }
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div
                    className={cn(
                      "grid gap-2",
                      transfer ? "sm:grid-cols-2" : "sm:grid-cols-3"
                    )}
                  >
                    {!transfer && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Location</Label>
                        <LocationSelect
                          value={row.storageLocationId}
                          locations={locations}
                          onChange={(v) => patchRow(row.rowId, { storageLocationId: v })}
                          invalid={!!errors[rowErrorKey(row.rowId, "location")]}
                          disabled={isSubmitting}
                        />
                        <FieldError message={errors[rowErrorKey(row.rowId, "location")]} />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Quantity</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0"
                        value={row.quantity}
                        onChange={(e) => patchRow(row.rowId, { quantity: e.target.value })}
                        disabled={isSubmitting}
                        className={cn(
                          "h-9 text-sm tabular-nums",
                          errors[rowErrorKey(row.rowId, "quantity")] && "border-destructive"
                        )}
                      />
                      <FieldError message={errors[rowErrorKey(row.rowId, "quantity")]} />
                      {/* Advisory only — the 422 is what actually decides. */}
                      {hint != null && (
                        <p
                          className={cn(
                            "text-[10px]",
                            over
                              ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                          )}
                        >
                          On hand here: {hint}
                          {over && " — less than the quantity entered"}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Unit cost</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={row.unitCost}
                        onChange={(e) => patchRow(row.rowId, { unitCost: e.target.value })}
                        disabled={isSubmitting}
                        className="h-9 text-sm tabular-nums"
                      />
                      <FieldError message={errors[rowErrorKey(row.rowId, "unitCost")]} />
                    </div>
                  </div>

                  {/* Only `adjustment` has no fixed direction. No default —
                      +1 would silently invent stock, −1 destroy it. */}
                  {fixed === null && !transfer && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Direction <span className="text-destructive">*</span>
                      </Label>
                      <Segmented<"in" | "out">
                        value={
                          row.direction === 1 ? "in" : row.direction === -1 ? "out" : ""
                        }
                        options={[
                          { value: "in", label: "＋ In" },
                          { value: "out", label: "－ Out" },
                        ]}
                        onChange={(v) =>
                          patchRow(row.rowId, {
                            direction: (v === "in" ? 1 : -1) as StockDirection,
                          })
                        }
                        disabled={isSubmitting}
                      />
                      <FieldError message={errors[rowErrorKey(row.rowId, "direction")]} />
                    </div>
                  )}
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() =>
                patch({ rows: [...form.rows, emptyRow(`r${rowSeq.current++}`)] })
              }
              disabled={isSubmitting}
            >
              <Plus className="h-3.5 w-3.5" />
              Add part
            </Button>
          </div>

          {/* Live net per location — a transfer visibly balances to zero */}
          {netByLocation.size > 0 && (
            <div className="space-y-1.5 rounded-md border border-dashed bg-muted/40 p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                What this movement does
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {Array.from(netByLocation.entries()).map(([locationId, net]) => (
                  <Badge
                    key={locationId}
                    variant="outline"
                    className={cn(
                      "font-normal tabular-nums",
                      net < 0
                        ? "text-red-600 dark:text-red-400"
                        : net > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {locationName(locationId)} {net > 0 ? "+" : ""}
                    {net}
                  </Badge>
                ))}
                {transfer && (
                  <span className="text-[11px] text-muted-foreground">
                    Net{" "}
                    {Array.from(netByLocation.values()).reduce((a, b) => a + b, 0)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Shortfall from the 422 context block */}
          {shortfall && (
            <div className="space-y-1.5 rounded-md border border-destructive/30 bg-destructive/10 p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                Not enough stock
              </p>
              <p className="text-[11px] tabular-nums text-destructive/90">
                {partName(shortfall.partId)} at {locationName(shortfall.storageLocationId)} —
                requested {shortfall.requested} · available {shortfall.available} · short by{" "}
                {shortfall.shortBy}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Nothing was recorded. Your lines are still here.
              </p>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <Textarea
              className="min-h-14 resize-none text-sm"
              placeholder="Vendor, receipt number, or why this adjustment was needed…"
              value={form.noteBody}
              onChange={(e) => patch({ noteBody: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          {formError && !shortfall && (
            <p className="text-xs text-destructive">{formError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            Record movement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function LocationSelect({
  value,
  locations,
  onChange,
  invalid,
  disabled,
}: {
  value: string;
  locations: StorageLocation[];
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  // Built here rather than by the caller: this renders on EVERY line row of a
  // multi-line movement, and the catalog is the same object each time.
  const options = useMemo<SearchableSelectOption[]>(
    () =>
      locations.map((l) => ({
        value: String(l.id),
        label: l.name,
        hint: l.code ?? undefined,
      })),
    [locations]
  );

  return (
    <SearchableSelect
      options={options}
      value={value || undefined}
      onChange={onChange}
      disabled={disabled}
      placeholder="Select location"
      searchPlaceholder="Search locations…"
      emptyText="No locations found."
      className={cn("h-9 text-sm", invalid && "border-destructive")}
    />
  );
}
