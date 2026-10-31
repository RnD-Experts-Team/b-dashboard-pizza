"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { DateTimePicker, FieldError } from "@/components/maintenance-tickets/form-bits";
import { storageService } from "@/lib/api/services/storage.service";
import { getTicketsFieldErrors, isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { usePartStockAt, useStorageWrites } from "@/lib/hooks/use-storage";
import { formatQuantity } from "@/lib/maintenance/money";
import { PART_UNITS, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { stockActionById } from "@/lib/storage/stock-actions";
import {
  STOCK_FORM_FIELD_ORDER,
  buildStockMovementPayload,
  emptyStockForm,
  isStockFormDirty,
  partHint,
  shapeOf,
  spotLocationOf,
  validateStockForm,
  type StockForm,
  type StockFormField,
  type StockFormProblems,
} from "@/lib/storage/stock-forms";
import { useDiscardGuard, useResetOnOpen } from "./discard-guard";
import { IssueSearch } from "./issue-search";
import { SerialPicker } from "./serial-picker";
import { SpotPicker } from "./spot-picker";
import { StockIcon } from "./storage-shared";
import type { Part, TicketIssueHit } from "@/types/maintenance-system";
import type { PostableStockMovementType, StockMovement, StorageLocation } from "@/types/storage.types";

/**
 * One small dialog per "Record stock" action (docs/MAINTENANCE-UI.md §6):
 * Used on a ticket · Returned · Moved · Opening stock · Damaged or lost. Each
 * shows only its own fields; date and a note sit behind "More details".
 * Serial-tracked parts pick or type their serials instead of a quantity.
 */

export interface StockActionPrefill {
  partId?: number;
  locationId?: number;
}

export interface StockActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: PostableStockMovementType;
  parts: readonly Part[];
  locations: readonly StorageLocation[];
  prefill?: StockActionPrefill;
  canDeclareSpots?: boolean;
  onRecorded: (movement: StockMovement) => void;
}

/** The control each problem field focuses. */
const FIELD_IDS: Record<StockFormField, string> = {
  part_id: "stock-part",
  ticket_issue_id: "stock-issue",
  storage_location_id: "stock-location",
  to_location_id: "stock-to-location",
  quantity: "stock-quantity",
  serials: "stock-serials",
  moved_at: "stock-moved-at",
};

/** Index of a move's destination line in the payload. */
const DESTINATION_LINE = "1";

/** A server 422 key → the field showing it ("lines.0.quantity" → quantity). */
function fieldOfServerKey(key: string): StockFormField | null {
  if (key === "ticket_issue_id" || key === "moved_at") return key;
  const [root, index, field] = key.split(".");
  if (root !== "lines") return null;
  if (field === "serials") return "serials";
  if (field === "quantity") return "quantity";
  if (field === "part_id") return "part_id";
  if (field === "storage_location_id") return index === DESTINATION_LINE ? "to_location_id" : "storage_location_id";
  return null;
}

export function StockActionDialog({
  open,
  onOpenChange,
  type,
  parts,
  locations,
  prefill,
  canDeclareSpots,
  onRecorded,
}: StockActionDialogProps) {
  const t = useTranslations("maintenanceSystem");
  const action = stockActionById(type);
  const shape = shapeOf(type);
  const { recordMovement } = useStorageWrites();

  const [initial, setInitial] = useState<StockForm>(() => emptyStockForm({ partId: prefill?.partId, locationId: prefill?.locationId }));
  const [form, setForm] = useState<StockForm>(initial);
  const [issue, setIssue] = useState<TicketIssueHit | null>(null);
  const [problems, setProblems] = useState<StockFormProblems>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<StockFormField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLFormElement>(null);
  const prefillPart = prefill?.partId;
  const prefillLocation = prefill?.locationId;

  useResetOnOpen(open, () => {
    const next = emptyStockForm({ partId: prefillPart, locationId: prefillLocation });
    setInitial(next);
    setForm(next);
    setIssue(null);
    setProblems({});
    setServerErrors({});
    setFormError(null);
    setMoreOpen(false);
  });

  const part = parts.find((p) => p.id === form.partId) ?? null;
  const trackSerials = part?.trackSerials ?? false;
  const unitLabel = vocabText(t, vocabEntry(PART_UNITS, part?.unit ?? "each"));
  const { locations: stockAt, isLoading: stockLoading } = usePartStockAt(form.partId);
  const onHandAt = (locationId: number | null) => stockAt.find((l) => l.storageLocationId === locationId)?.onHand ?? 0;
  const available = shape.flow === "in" || form.locationId == null ? null : onHandAt(form.locationId);

  const sourceLocations = useMemo(
    () => (shape.flow === "in" ? locations : locations.filter((l) => onHandAt(l.id) > 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locations, shape.flow, stockAt],
  );

  const dirty = isStockFormDirty(form, initial);
  const guard = useDiscardGuard(dirty && !saving, () => onOpenChange(false));

  const partOptions = useMemo(
    () => parts.map((p) => ({ value: p.id, label: p.name, hint: partHint(p) || undefined })),
    [parts],
  );

  function patch(next: Partial<StockForm>, fields: StockFormField[]) {
    setForm((prev) => ({ ...prev, ...next }));
    setProblems((prev) => {
      const copy = { ...prev };
      fields.forEach((f) => delete copy[f]);
      return copy;
    });
    setServerErrors((prev) => {
      const copy = { ...prev };
      fields.forEach((f) => delete copy[f]);
      return copy;
    });
  }

  function messageFor(field: StockFormField): string | undefined {
    const problem = problems[field];
    if (problem) return t(`storage.record.problems.${problem}`, { available: formatQuantity(available), unit: unitLabel });
    return serverErrors[field];
  }

  function focusFirst(fields: StockFormField[]) {
    const first = STOCK_FORM_FIELD_ORDER.find((f) => fields.includes(f));
    if (!first) return;
    if (first === "moved_at") setMoreOpen(true);
    const el = bodyRef.current?.querySelector<HTMLElement>(`#${FIELD_IDS[first]}, [data-field="${first}"] button, [data-field="${first}"] input`);
    el?.focus();
  }

  async function submit() {
    setFormError(null);
    const found = validateStockForm(type, form, { trackSerials, available });
    if (Object.keys(found).length) {
      setProblems(found);
      focusFirst(Object.keys(found) as StockFormField[]);
      return;
    }
    setSaving(true);
    try {
      const movement = await recordMovement.run(buildStockMovementPayload(type, form, trackSerials));
      const spotLocation = spotLocationOf(type, form);
      if (spotLocation != null && form.partId != null) {
        // The spot lives on the (part, location) balance row the movement just wrote.
        const balances = await storageService.getStockBalances({ part_ids: [form.partId], storage_location_ids: [spotLocation], per_page: 1 });
        const balance = balances.data[0];
        if (balance) await storageService.setStockBalancePlace(balance.id, form.placeValueIds);
      }
      toast.success(t("storage.record.saved", { action: t(`stock.actions.${type}.label`) }));
      onRecorded(movement);
      onOpenChange(false);
    } catch (err) {
      if (isCancelled(err)) return;
      const fields = getTicketsFieldErrors(err);
      const mapped: Partial<Record<StockFormField, string>> = {};
      const rest: string[] = [];
      Object.entries(fields).forEach(([key, message]) => {
        const field = fieldOfServerKey(key);
        if (field && !mapped[field]) mapped[field] = message;
        else if (!field) rest.push(message);
      });
      setServerErrors(mapped);
      if (rest.length) setFormError(rest.join(" "));
      if (!Object.keys(fields).length) setFormError(err instanceof Error ? err.message : t("common.saveError"));
      focusFirst(Object.keys(mapped) as StockFormField[]);
    } finally {
      setSaving(false);
    }
  }

  const locationLabel = t(`storage.record.location.${shape.flow}`);
  const spotLocationId = shape.flow === "both" ? form.toLocationId : form.locationId;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : guard.requestClose())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading font-semibold">
              <StockIcon name={action.icon} className="h-4 w-4 text-muted-foreground" />
              {t(`stock.actions.${type}.label`)}
            </DialogTitle>
            <DialogDescription>{t(`stock.actions.${type}.help`)}</DialogDescription>
          </DialogHeader>

          <form
            ref={bodyRef}
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {/* Part */}
            <div className="space-y-1.5" data-field="part_id">
              <Label htmlFor={FIELD_IDS.part_id}>
                {t("storage.record.part")} <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={partOptions}
                value={form.partId ?? ""}
                onChange={(id) => patch({ partId: id, serials: [], locationId: shape.flow === "in" ? form.locationId : null }, ["part_id", "serials", "quantity"])}
                placeholder={t("storage.record.partPlaceholder")}
                searchPlaceholder={t("storage.record.partSearch")}
                emptyText={t("storage.record.noParts")}
                className={messageFor("part_id") ? "border-destructive" : undefined}
              />
              <FieldError message={messageFor("part_id")} />
            </div>

            {/* Ticket issue (used) */}
            {shape.needsIssue && (
              <div className="space-y-1.5" data-field="ticket_issue_id">
                <Label htmlFor={FIELD_IDS.ticket_issue_id}>
                  {t("storage.record.ticket")} <span className="text-destructive">*</span>
                </Label>
                <IssueSearch
                  id={FIELD_IDS.ticket_issue_id}
                  value={issue}
                  onChange={(hit) => {
                    setIssue(hit);
                    patch({ ticketIssueId: hit?.id ?? null }, ["ticket_issue_id"]);
                  }}
                  invalid={Boolean(messageFor("ticket_issue_id"))}
                />
                <FieldError message={messageFor("ticket_issue_id")} />
              </div>
            )}

            {/* Location(s) */}
            <div className={shape.flow === "both" ? "grid gap-4 sm:grid-cols-2" : undefined}>
              <div className="space-y-1.5">
                <Label htmlFor={FIELD_IDS.storage_location_id}>
                  {locationLabel} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.locationId != null ? String(form.locationId) : ""}
                  onValueChange={(v) => patch({ locationId: Number(v), serials: [], placeValueIds: shape.flow === "in" ? [] : form.placeValueIds }, ["storage_location_id", "serials", "quantity"])}
                  disabled={!form.partId || (shape.flow !== "in" && stockLoading)}
                >
                  <SelectTrigger id={FIELD_IDS.storage_location_id} className="h-9" aria-invalid={Boolean(messageFor("storage_location_id"))}>
                    <SelectValue placeholder={form.partId ? t("storage.record.pickLocation") : t("storage.record.pickPartFirst")} />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceLocations.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                        {shape.flow !== "in" && (
                          <span className="ms-2 text-xs text-muted-foreground tabular-nums">
                            {t("storage.record.onHandHere", { qty: formatQuantity(onHandAt(l.id)), unit: unitLabel })}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.partId != null && shape.flow !== "in" && !stockLoading && sourceLocations.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">{t("storage.record.noneInStorage")}</p>
                )}
                <FieldError message={messageFor("storage_location_id")} />
              </div>

              {shape.flow === "both" && (
                <div className="space-y-1.5">
                  <Label htmlFor={FIELD_IDS.to_location_id}>
                    {t("storage.record.location.to")} <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.toLocationId != null ? String(form.toLocationId) : ""}
                    onValueChange={(v) => patch({ toLocationId: Number(v), placeValueIds: [] }, ["to_location_id"])}
                    disabled={!form.partId}
                  >
                    <SelectTrigger id={FIELD_IDS.to_location_id} className="h-9" aria-invalid={Boolean(messageFor("to_location_id"))}>
                      <SelectValue placeholder={t("storage.record.pickLocation")} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)} disabled={l.id === form.locationId}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={messageFor("to_location_id")} />
                </div>
              )}
            </div>

            {/* Spot inside the destination (optional) */}
            {shape.offersSpot && spotLocationId != null && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">
                  {t("storage.record.spot")} <span className="text-xs font-normal text-muted-foreground">({t("common.optional")})</span>
                </p>
                <SpotPicker
                  locationId={spotLocationId}
                  value={form.placeValueIds}
                  onChange={(ids) => patch({ placeValueIds: ids }, [])}
                  canDeclare={canDeclareSpots}
                  hideWhenEmpty
                />
              </div>
            )}

            {/* Quantity, or the serials */}
            {part && trackSerials ? (
              <div className="space-y-1.5" data-field="serials">
                <Label id={FIELD_IDS.serials}>
                  {t("storage.record.serials")} <span className="text-destructive">*</span>
                </Label>
                <p className="text-[11px] text-muted-foreground">{t("storage.record.serialsHelp", { count: form.serials.length })}</p>
                <SerialPicker
                  partId={part.id}
                  flow={shape.flow}
                  locationId={form.locationId}
                  value={form.serials}
                  onChange={(serials) => patch({ serials }, ["serials"])}
                  invalid={Boolean(messageFor("serials"))}
                />
                <FieldError message={messageFor("serials")} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={FIELD_IDS.quantity}>
                  {t("storage.record.quantity")} <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={FIELD_IDS.quantity}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={form.quantity}
                    onChange={(e) => patch({ quantity: e.target.value }, ["quantity"])}
                    aria-invalid={Boolean(messageFor("quantity"))}
                    className="h-9 w-32 tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">{unitLabel}</span>
                  {available != null && (
                    <span className="ms-auto text-xs text-muted-foreground tabular-nums">
                      {t("storage.record.onHandHere", { qty: formatQuantity(available), unit: unitLabel })}
                    </span>
                  )}
                </div>
                <FieldError message={messageFor("quantity")} />
              </div>
            )}

            {/* More details: when, and a note */}
            <div>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMoreOpen((v) => !v)}>
                {moreOpen ? <ChevronUp className="me-1 h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="me-1 h-3.5 w-3.5" aria-hidden="true" />}
                {moreOpen ? t("common.fewerDetails") : t("common.moreDetails")}
              </Button>
              {moreOpen && (
                <div className="mt-2 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={FIELD_IDS.moved_at}>{t("storage.record.when")}</Label>
                    <div id={FIELD_IDS.moved_at}>
                      <DateTimePicker value={form.movedAt} onChange={(v) => patch({ movedAt: v }, ["moved_at"])} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t("storage.record.whenHelp")}</p>
                    <FieldError message={messageFor("moved_at")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="stock-note">
                      {t("common.note")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
                    </Label>
                    <Textarea id="stock-note" rows={2} value={form.note} onChange={(e) => patch({ note: e.target.value }, [])} />
                  </div>
                </div>
              )}
            </div>

            {formError && <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">{formError}</p>}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={guard.requestClose} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {saving ? t("common.saving") : t("storage.record.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}
