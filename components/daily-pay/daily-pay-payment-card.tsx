"use client";

import { useMemo } from "react";
import { Coins, Merge, Paperclip, Plus, Store, Trash2, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/shared/searchable-select";
import { MoneyField } from "./daily-pay-num-field";
import { PayShapePicker } from "./pay-shape-picker";
import { DailyPayNoteList } from "./daily-pay-note-list";
import { DailyPayLineFieldset } from "./daily-pay-line-fieldset";
import { PayFieldset, PayFoldout } from "./daily-pay-fieldset";
import { DailyPayWarningsPanel } from "./daily-pay-warnings-panel";
import { PaymentFormSummary } from "./payment-form-summary";
import {
  emptyLine,
  payeeIdsInUse,
  switchPayShape,
  toNum,
  type LineForm,
  type PaymentForm,
} from "@/lib/daily-pay/entry-form-state";
import { formatMoney } from "@/lib/daily-pay/money";
import { previewPaymentForm } from "@/lib/daily-pay/payment-form-preview";
import { paymentError, paymentHasError, type DailyPayFormErrors } from "@/lib/daily-pay/field-errors";
import type { DailyPayAggregationWarning } from "@/types/daily-pay.types";
import type { CatalogTechnician } from "@/types/maintenance-tickets.types";
import type { DailyPayStoreOption } from "@/lib/hooks/use-daily-pay";

interface DailyPayPaymentCardProps {
  payment: PaymentForm;
  index: number;
  allPayments: PaymentForm[];
  stores: DailyPayStoreOption[];
  technicians: CatalogTechnician[];
  errors: DailyPayFormErrors;
  disabled?: boolean;
  canRemove: boolean;
  /** Read-only advisories carried through from the loaded entry, in edit mode. */
  warnings: DailyPayAggregationWarning[] | null;
  onPatch: (patch: Partial<PaymentForm>) => void;
  onPatchLine: (lineIndex: number, patch: Partial<LineForm>) => void;
  onRemove: () => void;
  /** Requests a payee change — the parent confirms first if issues are linked. */
  onRequestPayeeChange: (technicianId: string) => void;
  onMergeIntoExisting: () => void;
  onOpenIssuePicker: (lineIndex: number) => void;
  onFocusPayment: () => void;
  onFocusLine: (lineIndex: number) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}

export function DailyPayPaymentCard({
  payment,
  index,
  allPayments,
  stores,
  technicians,
  errors,
  disabled,
  canRemove,
  warnings,
  onPatch,
  onPatchLine,
  onRemove,
  onRequestPayeeChange,
  onMergeIntoExisting,
  onOpenIssuePicker,
  onFocusPayment,
  onFocusLine,
  cardRef,
}: DailyPayPaymentCardProps) {
  const err = (field: string) => paymentError(errors, index, field);
  const hasError = paymentHasError(errors, index);

  // Prevention: a payee already on another payment cannot be picked again.
  // All of a payee's stores belong on the ONE payment.
  const takenPayeeIds = payeeIdsInUse(allPayments, index);
  const payeeOptions = useMemo<SearchableSelectOption[]>(
    () =>
      technicians.map((t) => {
        const taken = takenPayeeIds.has(t.id);
        return {
          value: String(t.id),
          label: t.name,
          // "already on this sheet" is the REASON the row is greyed, so it has
          // to stay visible next to it rather than only in a tooltip.
          hint:
            [t.categoryName, taken ? "already on this sheet" : null]
              .filter(Boolean)
              .join(" · ") || undefined,
          disabled: taken,
        };
      }),
    [technicians, takenPayeeIds]
  );
  const payeeId = toNum(payment.technicianId);
  const isDuplicate = payeeId != null && takenPayeeIds.has(payeeId);
  const payeeName = technicians.find((t) => t.id === payeeId)?.name ?? null;

  const shape = payment.payShape;

  const storeLabel = (line: LineForm, j: number) => {
    if (line.locationKind === "other") return line.otherStore.trim() || `Store ${j + 1}`;
    const store = stores.find((s) => String(s.id) === line.storeId);
    return store ? `Store ${store.storeNumber}` : `Store ${j + 1}`;
  };

  const perStorePrices = useMemo(() => {
    const prices = payment.lines
      .map((line) => toNum(line.lumpSum))
      .filter((v): v is number => v != null);
    return {
      entered: prices.length,
      sum: prices.reduce((cents, v) => cents + Math.round(v * 100), 0) / 100,
    };
  }, [payment.lines]);

  // Under "store by store", how the stores have actually been split.
  const storeSplit = {
    fixed: payment.lines.filter((line) => line.labourMode === "lumpSum").length,
    hourly: payment.lines.filter((line) => line.labourMode !== "lumpSum").length,
  };

  // Recomputed every render on purpose: it is a handful of additions, and a
  // memo keyed on the right fields would be one more thing to get wrong.
  const preview = previewPaymentForm(payment, storeLabel);

  return (
    <div
      ref={cardRef}
      className={cn(
        // space-y-5 between groups, space-y-3 inside one. Five short questions
        // rather than one long undifferentiated form.
        "space-y-5 rounded-lg border border-s-2 border-s-primary bg-card p-4",
        hasError && "border-destructive/60 border-s-destructive"
      )}
      onFocus={onFocusPayment}
    >
      <div className="flex items-center justify-between border-b pb-3">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          Payment {index + 1}
        </h4>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            disabled={disabled}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* 1. WHO IS PAID. */}
      <PayFieldset legend="Who is paid" icon={User}>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Payee <span className="text-destructive">*</span>
        </Label>
        <SearchableSelect
          options={payeeOptions}
          value={payment.technicianId || undefined}
          onChange={onRequestPayeeChange}
          disabled={disabled}
          placeholder="Select payee"
          searchPlaceholder="Search payees…"
          emptyText="No technicians found."
          className={cn("h-9 text-sm", err("technician_id") && "border-destructive")}
        />
        {err("technician_id") ? (
          <div className="space-y-1">
            <p className="text-[11px] text-destructive">{err("technician_id")}</p>
            {/* Detection, not just prevention: edit-mode prefill and payee
                changes can both produce a duplicate without passing through
                the dropdown, so offer the fix rather than just the error. */}
            {isDuplicate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={onMergeIntoExisting}
                disabled={disabled}
              >
                <Merge className="h-3 w-3" />
                Merge into the existing payment
              </Button>
            )}
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            A company is a technician named after the company. All their stores go on this
            one payment.
          </p>
        )}
      </div>
      </PayFieldset>

      {/* 2. HOW THEY ARE PAID. The fork that decides what every field below --
          including every store's "how this store is paid" -- means, so it gets
          a group of its own rather than sharing one with the gas money. */}
      <PayFieldset
        legend="How this one is paid"
        icon={Coins}
        hint="Pick one. It decides what each store below can do."
      >
        <PayShapePicker
          value={shape}
          onChange={(next) => onPatch(switchPayShape(payment, next))}
          disabled={disabled}
          renderField={(option, active) => {
            if (option === "hourly") {
              return (
                <MoneyField
                  label="Default hourly rate"
                  value={payment.hourlyPaymentRate}
                  onChange={(hourlyPaymentRate) => onPatch({ hourlyPaymentRate })}
                  disabled={disabled || !active}
                  error={active ? err("hourly_payment_rate") : undefined}
                  hint={
                    active
                      ? "Any store without its own rate uses this."
                      : shape === "mixed"
                        ? "The same rate is set under “Store by store”."
                        : "Not used — this payee is on a fixed price."
                  }
                />
              );
            }
            if (option === "mixed") {
              return (
                <div className="space-y-2">
                  {/* The same payment rate as "By the hour" -- one value, shown
                      where it is live. It only reaches the hourly stores. */}
                  <MoneyField
                    label="Default rate for the hourly stores"
                    value={payment.hourlyPaymentRate}
                    onChange={(hourlyPaymentRate) => onPatch({ hourlyPaymentRate })}
                    disabled={disabled || !active}
                    error={active ? err("hourly_payment_rate") : undefined}
                    hint={
                      active
                        ? "Stores at a fixed price ignore it."
                        : "Choose this option to pick per store."
                    }
                  />
                  {active && (
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {storeSplit.hourly} by the hour · {storeSplit.fixed} at a fixed price
                    </p>
                  )}
                </div>
              );
            }
            if (option === "fixedDay") {
              return (
                <MoneyField
                  label="Price for the day"
                  value={payment.lumpSum}
                  onChange={(lumpSum) => onPatch({ lumpSum })}
                  disabled={disabled || !active}
                  error={active ? err("lump_sum") : undefined}
                  hint={
                    active
                      ? "Covers every store below. Hours do not change it."
                      : "Choose this option to use it."
                  }
                  required={active}
                />
              );
            }
            return (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Store prices</p>
                <p
                  className={cn(
                    "flex h-9 items-center text-sm tabular-nums",
                    !active && "text-muted-foreground"
                  )}
                >
                  {perStorePrices.entered > 0
                    ? `${formatMoney(perStorePrices.sum)} across ${perStorePrices.entered} of ${payment.lines.length} ${payment.lines.length === 1 ? "store" : "stores"}`
                    : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {active
                    ? "Type each store's price on the store, below."
                    : "Choose this option to set a price on each store."}
                </p>
              </div>
            );
          }}
        />

        {/* Money that rides along with the labour but is not labour. Its own
            sub-group, because "what is the rate" and "how much fuel" are two
            different questions and they were sitting in one four-cell grid. */}
        <PayFieldset legend="On top of the pay" tone="quiet">
          <p className="-mt-1 text-[11px] text-muted-foreground">
            Added on top whichever way they are paid — even on a fixed price.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyField
              label="Gas"
              value={payment.gas}
              onChange={(gas) => onPatch({ gas })}
              disabled={disabled}
              error={err("gas")}
              hint="Fuel not tied to one store. A store's own fuel goes on that store."
            />
            <MoneyField
              label="Additional owed"
              value={payment.moneyOwed}
              onChange={(moneyOwed) => onPatch({ moneyOwed })}
              disabled={disabled}
              error={err("money_owed")}
              hint="An extra amount on top — not the total. The total is worked out below."
            />
          </div>
        </PayFieldset>

        {/* 4. THE PAPERWORK. Optional, and used on a minority of payments, so
            it is folded -- with its count on the tab, so a payment that does
            carry a transfer receipt still says so while closed. */}
        <PayFoldout
          label="Attachments and notes"
          icon={Paperclip}
          count={payment.files.length + payment.notes.length}
        >
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            Payment attachments (optional)
          </Label>
          <Input
            type="file"
            multiple
            onChange={(e) =>
              onPatch({ files: [...payment.files, ...Array.from(e.target.files ?? [])] })
            }
            disabled={disabled}
            className="h-9 text-sm"
          />
          {payment.files.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {payment.files.map((f, fi) => (
                <span
                  key={fi}
                  className="inline-flex items-center gap-1 rounded border bg-card px-1.5 py-0.5 text-xs"
                >
                  {f.name}
                  <button
                    type="button"
                    className="ms-0.5 rounded-sm opacity-60 hover:opacity-100"
                    onClick={() =>
                      onPatch({ files: payment.files.filter((_, idx) => idx !== fi) })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <DailyPayNoteList
          notes={payment.notes}
          onChange={(notes) => onPatch({ notes })}
          disabled={disabled}
          label="No payment notes."
        />
        </PayFoldout>
      </PayFieldset>

      <DailyPayWarningsPanel warnings={warnings} />

      {/* 5. THE STORES. */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Store className="h-3.5 w-3.5" aria-hidden="true" />
            Stores ({payment.lines.length})
          </p>
          {payeeId == null && (
            <Badge variant="outline" className="font-normal text-[10px]">
              Pick a payee to link issues
            </Badge>
          )}
        </div>

        {/* What the choice above means for the stores, said where the stores
            are -- so nobody reaches a store's pay box wondering why it is locked. */}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {STORES_UNDER_SHAPE[shape]}
        </p>

        {err("lines") && <p className="text-[11px] text-destructive">{err("lines")}</p>}

        {payment.lines.map((line, j) => (
          <DailyPayLineFieldset
            key={j}
            line={line}
            paymentIndex={index}
            lineIndex={j}
            payShape={shape}
            paymentRate={payment.hourlyPaymentRate}
            dayPrice={payment.lumpSum}
            stores={stores}
            errors={errors}
            disabled={disabled}
            canRemove={payment.lines.length > 1}
            onPatch={(patch) => onPatchLine(j, patch)}
            onRemove={() =>
              onPatch({ lines: payment.lines.filter((_, idx) => idx !== j) })
            }
            onOpenIssuePicker={() => onOpenIssuePicker(j)}
            onFocusCapture={() => onFocusLine(j)}
            issuePickerDisabledReason={
              payeeId == null ? "Select a payee first" : undefined
            }
          />
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => onPatch({ lines: [...payment.lines, emptyLine()] })}
          disabled={disabled}
        >
          <Plus className="h-3.5 w-3.5" />
          Add store line
        </Button>
      </div>

      {/* 6. THE ANSWER. Last, because it reads everything above it. */}
      <PaymentFormSummary preview={preview} payeeName={payeeName} />
    </div>
  );
}

const STORES_UNDER_SHAPE: Record<PaymentForm["payShape"], string> = {
  hourly:
    "Paid by the hour: each store is paid its hours × a rate. Link the ticket issues so the logged hours are found.",
  fixedDay:
    "One price for the day: the stores below do not change the pay. They are still needed — they say where the work was, and linking the issues marks that work as paid.",
  fixedPerStore:
    "A price per store: type each store's price on the store. Link the issues so that work is marked as paid.",
  mixed:
    "Store by store: on each store, choose “How this store is paid” — its logged hours, hours you type, or a fixed price.",
};
