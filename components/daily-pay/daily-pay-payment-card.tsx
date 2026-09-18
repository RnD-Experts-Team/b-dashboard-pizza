"use client";

import { useMemo } from "react";
import { Merge, Paperclip, Plus, Trash2, User, X } from "lucide-react";
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
import { DailyPayWarningsPanel } from "./daily-pay-warnings-panel";
import {
  emptyLine,
  payeeIdsInUse,
  toNum,
  type LineForm,
  type PaymentForm,
  type PaymentLabourMode,
} from "@/lib/daily-pay/entry-form-state";
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

  return (
    <div
      ref={cardRef}
      className={cn(
        "space-y-3 rounded-lg border border-s-2 border-s-primary bg-card p-4",
        hasError && "border-destructive/60 border-s-destructive"
      )}
      onFocus={onFocusPayment}
    >
      <div className="flex items-center justify-between">
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

      {/* Payee */}
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
          <p className="text-[11px] text-muted-foreground">
            A company is a technician named after the company. All their stores go on this
            one payment.
          </p>
        )}
      </div>

      {/* Payment-level money — not attributable to any one store */}
      <div className="space-y-3 rounded-md bg-muted/40 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Payment level — not tied to one store
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {/*
            HOW IS THIS ONE PAID? Asked as two buttons rather than a dropdown of
            two jargon phrases, because it is the fork that decides what every
            field below means -- and because there are genuinely two processes
            here: our own technicians by the hour, and outside companies at an
            agreed price. They shared one form, and that is how a lump sum came
            to silently switch off hours that stayed on screen looking live.
          */}
          <div className="sm:col-span-2">
            <PayShapePicker
              value={payment.labourMode === "lumpSum" ? "fixed" : "hourly"}
              onChange={(shape) =>
                onPatch({ labourMode: (shape === "fixed" ? "lumpSum" : "sumLines") as PaymentLabourMode })
              }
              disabled={disabled}
            />
          </div>

          {payment.labourMode === "lumpSum" ? (
            <MoneyField
              label="Lump sum"
              value={payment.lumpSum}
              onChange={(lumpSum) => onPatch({ lumpSum })}
              disabled={disabled}
              error={err("lump_sum")}
              hint="Paid instead of the hours on every store, not on top of them."
              required
            />
          ) : (
            <MoneyField
              label="Default hourly rate"
              value={payment.hourlyPaymentRate}
              onChange={(hourlyPaymentRate) => onPatch({ hourlyPaymentRate })}
              disabled={disabled}
              error={err("hourly_payment_rate")}
              hint="Used for any store that does not set its own rate."
            />
          )}

          <MoneyField
            label="Gas"
            value={payment.gas}
            onChange={(gas) => onPatch({ gas })}
            disabled={disabled}
            error={err("gas")}
            hint="Fuel not attributable to one store."
          />
          <MoneyField
            label="Additional owed"
            value={payment.moneyOwed}
            onChange={(moneyOwed) => onPatch({ moneyOwed })}
            disabled={disabled}
            error={err("money_owed")}
            hint="An extra amount on top — not a total."
          />
        </div>

        {/* Payment-level attachments, e.g. proof of transfer */}
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
      </div>

      <DailyPayWarningsPanel warnings={warnings} />

      {/* Store lines */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Stores ({payment.lines.length})
          </p>
          {payeeId == null && (
            <Badge variant="outline" className="font-normal text-[10px]">
              Pick a payee to link issues
            </Badge>
          )}
        </div>

        {err("lines") && <p className="text-[11px] text-destructive">{err("lines")}</p>}

        {payment.lines.map((line, j) => (
          <DailyPayLineFieldset
            key={j}
            line={line}
            paymentIndex={index}
            lineIndex={j}
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
    </div>
  );
}
