"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtFixed } from "@/lib/utils/number-display";
import { toast } from "sonner";
import { ChevronDown, Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/shared/searchable-select";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { storageService } from "@/lib/api/services/storage.service";
import {
  getTicketsFieldErrors,
  isCancelled,
  readStockShortfall,
  type StockShortfallContext,
} from "@/lib/api/maintenance-tickets-errors";
import { SearchCreateCombobox } from "./search-create-combobox";
import { FieldError, Segmented } from "./form-bits";
import { PasteFileZone } from "./paste-file-zone";
import type { IssueDraft } from "@/lib/hooks/use-ticket-draft";
import type {
  CatalogPart,
  CatalogTechnician,
  PartUsagePayer,
  PartUsageSource,
  StorageLocationRef,
  TicketIssue,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Add Part Usage                                                           */
/*                                                                            */
/*  Extracted from ticket-detail-sheet.tsx: this went from ~95 lines to ~380, */
/*  it loads three catalogs of its own, and it has two call sites (per-issue  */
/*  and bulk), so it needs a real prop contract either way.                   */
/*                                                                            */
/*  Two things here carry real risk:                                          */
/*                                                                            */
/*   1. UNIT COST, NOT TOTAL. The old field was the total cost, so muscle     */
/*      memory will type the total into it. The label and helper text both    */
/*      say "one" for that reason.                                            */
/*   2. A `from_storage` draw MOVES STOCK in the same transaction, and fails  */
/*      with a 422 that creates nothing. The catch block must never call      */
/*      onSuccess / onClose / onClearDraftFields on that path.                */
/* ────────────────────────────────────────────────────────────────────────── */

function asOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export interface PartUsagePanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  /** Full technician list. See the note on the payer select below. */
  technicians: CatalogTechnician[];
  issueIds?: number[];
  issueDraft: IssueDraft;
  onPatchDraft: (patch: Partial<IssueDraft>) => void;
  onClearDraftFields: (keys: Array<keyof IssueDraft>) => void;
  onClose: () => void;
  onSuccess: () => void;
}

export function PartUsagePanel({
  issue,
  storeId,
  ticketId,
  technicians,
  issueIds,
  issueDraft,
  onPatchDraft,
  onClearDraftFields,
  onClose,
  onSuccess,
}: PartUsagePanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<StockShortfallContext | null>(null);
  const [returnsOpen, setReturnsOpen] = useState(
    () => !!issueDraft.partReturnedQuantity
  );

  const [catalogParts, setCatalogParts] = useState<CatalogPart[]>([]);
  const [partsLoading, setPartsLoading] = useState(true);
  const [locations, setLocations] = useState<StorageLocationRef[]>([]);
  const [onHand, setOnHand] = useState<number | null>(null);

  const source = issueDraft.partSource as PartUsageSource | "";
  const paidBy = issueDraft.partPaidBy as PartUsagePayer | "";

  const quantity = asOptionalNumber(issueDraft.partQuantity);
  const unitCost = asOptionalNumber(issueDraft.partUnitCost);
  const returnedQuantity = asOptionalNumber(issueDraft.partReturnedQuantity);

  /* ── Catalogs ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    const ctrl = new AbortController();
    setPartsLoading(true);
    maintenanceTicketsService
      .getCatalogParts(ctrl.signal)
      .then((parts) => setCatalogParts(parts.filter((p) => !p.deletedAt)))
      .catch(() => {})
      .finally(() => setPartsLoading(false));
    return () => ctrl.abort();
  }, []);

  // Storage locations are only needed once the user says the part came off a
  // shelf, or is going back onto one.
  const needsLocations = source === "from_storage" || returnsOpen;
  useEffect(() => {
    if (!needsLocations || locations.length > 0) return;
    const ctrl = new AbortController();
    storageService
      .listStorageLocations(ctrl.signal)
      .then(setLocations)
      .catch(() => {});
    return () => ctrl.abort();
  }, [needsLocations, locations.length]);

  /** Creates a catalog part and returns the new id. Called by the combobox. */
  async function createCatalogPart(name: string): Promise<number> {
    const newPart = await maintenanceTicketsService.createCatalogPart({ name });
    setCatalogParts((prev) => [...prev, newPart]);
    return newPart.id;
  }

  /* ── Computed previews ────────────────────────────────────────────────── */

  const grossCost = useMemo(
    () => (quantity != null && unitCost != null ? quantity * unitCost : null),
    [quantity, unitCost]
  );
  const netQuantity = useMemo(
    () =>
      quantity != null && returnedQuantity != null
        ? quantity - returnedQuantity
        : quantity ?? null,
    [quantity, returnedQuantity]
  );
  const netCost = useMemo(
    () => (netQuantity != null && unitCost != null ? netQuantity * unitCost : null),
    [netQuantity, unitCost]
  );

  const locationOptions = useMemo<SearchableSelectOption[]>(
    () =>
      locations.map((loc) => ({
        value: String(loc.id),
        label: loc.name,
        hint: loc.code ?? undefined,
      })),
    [locations]
  );

  // Order is load-bearing: the issue's own technicians sort first. Array.filter
  // is order-preserving, so the sort survives the search box.
  const payerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      sortAttachedFirst(technicians, issue).map((tech) => ({
        value: String(tech.id),
        label: tech.name,
      })),
    [technicians, issue]
  );

  /** Advisory only — the 422 is what actually decides. */
  const overdrawn =
    source === "from_storage" && onHand != null && quantity != null && quantity > onHand;

  /* ── Reset transient state on any edit ────────────────────────────────── */

  function patch(next: Partial<IssueDraft>) {
    onPatchDraft(next);
    // A shortfall callout refers to the numbers as they were; clear it.
    setShortfall(null);
    setFormError(null);
    setFieldErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      return {};
    });
  }

  /* ── Submit ───────────────────────────────────────────────────────────── */

  function validate(): string | null {
    const errors: Record<string, string> = {};
    const partId = asOptionalNumber(issueDraft.partId);

    if (!partId) errors.part_id = "Part is required.";
    if (quantity == null || quantity <= 0) errors.quantity = "Enter a quantity above zero.";
    if (unitCost == null || unitCost < 0) errors.unit_cost = "Enter the cost of one unit.";
    if (!source) errors.source = "Say where the part came from.";
    if (!paidBy) errors.paid_by = "Say who paid.";
    if (source === "from_storage" && !asOptionalNumber(issueDraft.partStorageLocationId)) {
      errors.storage_location_id = "Pick the shelf they came off.";
    }
    if (paidBy === "technician" && !asOptionalNumber(issueDraft.partPaidByTechnicianId)) {
      errors.paid_by_technician_id = "Pick who paid.";
    }
    if (returnedQuantity != null) {
      if (returnedQuantity < 0) {
        errors.returned_quantity = "Cannot be negative.";
      } else if (quantity != null && returnedQuantity > quantity) {
        errors.returned_quantity = `Cannot exceed the quantity used (${quantity}).`;
      }
      if (
        returnedQuantity > 0 &&
        !asOptionalNumber(issueDraft.partReturnedToStorageLocationId)
      ) {
        errors.returned_to_storage_location_id = "Pick where the remainder went.";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length ? "Some fields need attention." : null;
  }

  async function handleSubmit() {
    setFormError(null);
    setShortfall(null);
    const invalid = validate();
    if (invalid) return;

    setIsSubmitting(true);
    try {
      const vendorNote = issueDraft.partVendorNote.trim();
      await maintenanceTicketsService.createPartUsage(
        storeId,
        ticketId,
        {
          // Parts still require every issue to belong to this ticket — the
          // cross-ticket relaxation is attendance-only.
          ticket_issue_ids: issueIds ?? [issue.id],
          part_id: asOptionalNumber(issueDraft.partId)!,
          quantity: quantity!,
          unit_cost: unitCost!,
          source: source as PartUsageSource,
          paid_by: paidBy as PartUsagePayer,
          ...(paidBy === "technician"
            ? {
                paid_by_technician_id: asOptionalNumber(
                  issueDraft.partPaidByTechnicianId
                )!,
              }
            : {}),
          ...(source === "from_storage"
            ? {
                storage_location_id: asOptionalNumber(
                  issueDraft.partStorageLocationId
                )!,
              }
            : {}),
          ...(returnedQuantity != null && returnedQuantity > 0
            ? {
                returned_quantity: returnedQuantity,
                returned_to_storage_location_id: asOptionalNumber(
                  issueDraft.partReturnedToStorageLocationId
                )!,
              }
            : {}),
          ...(vendorNote ? { notes: [{ body: vendorNote }] } : {}),
        },
        files
      );

      // Everything below stays INSIDE the try, after the await resolves. A
      // failed storage draw creates nothing, so it must not clear the draft,
      // close the panel, or trigger the list refetch.
      onClearDraftFields([
        "partId",
        "partCost",
        "partQuantity",
        "partUnitCost",
        "partSource",
        "partPaidBy",
        "partPaidByTechnicianId",
        "partStorageLocationId",
        "partReturnedQuantity",
        "partReturnedToStorageLocationId",
        "partVendorNote",
      ]);
      setFiles([]);
      toast.success("Part usage saved successfully");
      onSuccess();
      onClose();
    } catch (err) {
      if (isCancelled(err)) return;

      if (err instanceof MaintenanceTicketsError) {
        // Not enough on the shelf. The advisory check above is friendlier but
        // is explicitly NOT authoritative, so this path must always work.
        const short = readStockShortfall(err);
        if (short) {
          setShortfall(short);
          setFieldErrors({ quantity: err.message });
          return;
        }
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

  /* ── Render ───────────────────────────────────────────────────────────── */

  const partName =
    catalogParts.find((p) => p.id === asOptionalNumber(issueDraft.partId))?.name ??
    "this part";

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Add Part Usage
      </p>

      {/* Part */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Part <span className="text-destructive">*</span>
        </Label>
        <SearchCreateCombobox
          items={catalogParts.map((p) => ({ id: p.id, label: p.name }))}
          selectedId={asOptionalNumber(issueDraft.partId) ?? null}
          onSelect={(id) => {
            patch({ partId: id != null ? String(id) : "" });
            setOnHand(null);
          }}
          onCreate={createCatalogPart}
          placeholder="Search parts or type to create a new one…"
          loading={partsLoading}
        />
        <FieldError message={fieldErrors.part_id} />
      </div>

      {/* Quantity + unit cost */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Quantity <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            className={cn("h-8 tabular-nums", fieldErrors.quantity && "border-destructive")}
            placeholder="0"
            value={issueDraft.partQuantity}
            onChange={(e) => patch({ partQuantity: e.target.value })}
          />
          <FieldError message={fieldErrors.quantity} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Cost of ONE ($) <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            className={cn("h-8 tabular-nums", fieldErrors.unit_cost && "border-destructive")}
            placeholder="0.00"
            value={issueDraft.partUnitCost}
            onChange={(e) => patch({ partUnitCost: e.target.value })}
          />
          {fieldErrors.unit_cost ? (
            <FieldError message={fieldErrors.unit_cost} />
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Per unit, not the total.
            </p>
          )}
        </div>
      </div>

      {/* Computed gross cost */}
      {grossCost != null && (
        <div className="flex items-baseline justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total
          </span>
          <span className="text-right">
            <span className="text-sm font-semibold tabular-nums">{money(grossCost)}</span>
            <span className="ms-1.5 text-[10px] text-muted-foreground tabular-nums">
              {quantity} × {money(unitCost!)}
            </span>
          </span>
        </div>
      )}

      {/* Source */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Where from <span className="text-destructive">*</span>
        </Label>
        <Segmented<PartUsageSource>
          value={source}
          options={[
            { value: "purchased", label: "Purchased" },
            { value: "from_storage", label: "From storage" },
          ]}
          onChange={(v) => {
            patch({ partSource: v });
            setOnHand(null);
          }}
          disabled={isSubmitting}
        />
        <FieldError message={fieldErrors.source} />
      </div>

      {/* Shelf, when drawing from storage */}
      {source === "from_storage" && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Which shelf did they come off? <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            options={locationOptions}
            value={issueDraft.partStorageLocationId || undefined}
            onChange={(v) => patch({ partStorageLocationId: v })}
            disabled={isSubmitting}
            placeholder="Select a location"
            searchPlaceholder="Search locations…"
            emptyText="No locations found."
            className={cn(
              "h-8 text-sm",
              fieldErrors.storage_location_id && "border-destructive"
            )}
          />
          <FieldError message={fieldErrors.storage_location_id} />
          {overdrawn && (
            <p className="text-[11px] text-red-600 dark:text-red-400">
              On hand here: {onHand} — less than the quantity entered.
            </p>
          )}
        </div>
      )}

      {/* Inline shortfall from the 422 `context` block */}
      {shortfall && (
        <div className="space-y-1.5 rounded-md border border-destructive/30 bg-destructive/10 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            Not enough stock
          </p>
          <p className="text-[11px] text-destructive/90 tabular-nums">
            Requested {fmtFixed(shortfall.requested, 2)} · Available{" "}
            {fmtFixed(shortfall.available, 2)} · Short by {fmtFixed(shortfall.shortBy, 2)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Nothing was saved — {partName} is still where it was.
          </p>
          {shortfall.available > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[11px]"
              onClick={() => patch({ partQuantity: String(shortfall.available) })}
            >
              Use {fmtFixed(shortfall.available, 2)}
            </Button>
          )}
        </div>
      )}

      {/* Paid by */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Who paid <span className="text-destructive">*</span>
        </Label>
        <Segmented<PartUsagePayer>
          value={paidBy}
          options={[
            { value: "us", label: "Us" },
            { value: "technician", label: "Technician" },
          ]}
          onChange={(v) => patch({ partPaidBy: v })}
          disabled={isSubmitting}
        />
        {fieldErrors.paid_by ? (
          <FieldError message={fieldErrors.paid_by} />
        ) : (
          paidBy === "us" && (
            <p className="text-[10px] text-muted-foreground">
              Nobody is owed for this, so it is not payable.
            </p>
          )
        )}
      </div>

      {paidBy === "technician" && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Paid by <span className="text-destructive">*</span>
          </Label>
          {/* The full list, with the issue's own technicians first. NOT narrowed
              to issue.technicians the way the attendance panel is: the payer
              need not be an attached tech, and in bulk mode the dummy issue has
              no technicians at all, which would render an empty dropdown. */}
          <SearchableSelect
            options={payerOptions}
            value={issueDraft.partPaidByTechnicianId || undefined}
            onChange={(v) => patch({ partPaidByTechnicianId: v })}
            disabled={isSubmitting}
            placeholder="Select technician"
            searchPlaceholder="Search technicians…"
            emptyText="No technicians found."
            className={cn(
              "h-8 text-sm",
              fieldErrors.paid_by_technician_id && "border-destructive"
            )}
          />
          <FieldError message={fieldErrors.paid_by_technician_id} />
        </div>
      )}

      {/* Returns */}
      <Collapsible open={returnsOpen} onOpenChange={setReturnsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/50">
          <span>Some went back on a shelf</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", returnsOpen && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Returned quantity</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                max={quantity != null ? String(quantity) : undefined}
                className={cn(
                  "h-8 tabular-nums",
                  fieldErrors.returned_quantity && "border-destructive"
                )}
                placeholder="0"
                value={issueDraft.partReturnedQuantity}
                onChange={(e) => patch({ partReturnedQuantity: e.target.value })}
              />
              <FieldError message={fieldErrors.returned_quantity} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Returned to</Label>
              <SearchableSelect
                options={locationOptions}
                value={issueDraft.partReturnedToStorageLocationId || undefined}
                onChange={(v) => patch({ partReturnedToStorageLocationId: v })}
                disabled={isSubmitting}
                placeholder="Select a location"
                searchPlaceholder="Search locations…"
                emptyText="No locations found."
                className={cn(
                  "h-8 text-sm",
                  fieldErrors.returned_to_storage_location_id && "border-destructive"
                )}
              />
              <FieldError message={fieldErrors.returned_to_storage_location_id} />
            </div>
          </div>

          {netCost != null && netQuantity != null && (
            <div className="flex items-baseline justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Net cost
              </span>
              <span className="text-right">
                <span className="text-sm font-semibold tabular-nums">{money(netCost)}</span>
                <span className="ms-1.5 text-[10px] text-muted-foreground tabular-nums">
                  net qty {netQuantity} — what the payer is out of pocket
                </span>
              </span>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Vendor / receipt — there is deliberately no vendor column */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Vendor / receipt details</Label>
        <Textarea
          className="min-h-14 resize-none text-sm"
          placeholder="Where it was bought, receipt number…"
          value={issueDraft.partVendorNote}
          onChange={(e) => patch({ partVendorNote: e.target.value })}
        />
        <p className="text-[10px] text-muted-foreground">
          There is no vendor field — this is saved as a note on the record.
        </p>
      </div>

      {/* Attachments */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Attachments</Label>
        <PasteFileZone files={files} onChange={setFiles} />
      </div>

      {formError && <p className="text-xs text-destructive">{formError}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || partsLoading}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

/** Technicians attached to this issue first, then everyone else. */
function sortAttachedFirst(
  technicians: CatalogTechnician[],
  issue: TicketIssue
): CatalogTechnician[] {
  const attached = new Set((issue.technicians ?? []).map((t) => t.id));
  return [...technicians]
    .filter((t) => !t.deletedAt)
    .sort((a, b) => {
      const aAttached = attached.has(a.id) ? 0 : 1;
      const bAttached = attached.has(b.id) ? 0 : 1;
      if (aAttached !== bAttached) return aAttached - bAttached;
      return a.name.localeCompare(b.name);
    });
}
