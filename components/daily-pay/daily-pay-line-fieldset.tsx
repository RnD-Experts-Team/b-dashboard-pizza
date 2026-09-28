"use client";

import { ListChecks, Paperclip, Trash2, X } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/shared/searchable-select";
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
import { MoneyField } from "./daily-pay-num-field";
import { DailyPayLabourControl } from "./daily-pay-labour-control";
import { DailyPayNoteList } from "./daily-pay-note-list";
import { PayFieldset, PayFoldout } from "./daily-pay-fieldset";
import type {
  LineForm,
  LineLocationKind,
  PaymentPayShape,
} from "@/lib/daily-pay/entry-form-state";
import type { DailyPayFormErrors } from "@/lib/daily-pay/field-errors";
import { lineError } from "@/lib/daily-pay/field-errors";
import type { DailyPayStoreOption } from "@/lib/hooks/use-daily-pay";

interface DailyPayLineFieldsetProps {
  line: LineForm;
  paymentIndex: number;
  lineIndex: number;
  /** How the payment pays -- decides what this store's pay box allows. */
  payShape: PaymentPayShape;
  /** The payment's default rate, as typed. */
  paymentRate: string;
  /** The payment's price for the day, as typed. */
  dayPrice: string;
  stores: DailyPayStoreOption[];
  errors: DailyPayFormErrors;
  disabled?: boolean;
  canRemove: boolean;
  onPatch: (patch: Partial<LineForm>) => void;
  onRemove: () => void;
  onOpenIssuePicker: () => void;
  /** Sets this line as the target for pasted files. */
  onFocusCapture: () => void;
  /** Blocked because the payment has no payee yet — issues are payee-scoped. */
  issuePickerDisabledReason?: string;
}

export function DailyPayLineFieldset({
  line,
  paymentIndex,
  lineIndex,
  payShape,
  paymentRate,
  dayPrice,
  stores,
  errors,
  disabled,
  canRemove,
  onPatch,
  onRemove,
  onOpenIssuePicker,
  onFocusCapture,
  issuePickerDisabledReason,
}: DailyPayLineFieldsetProps) {
  const err = (field: string) => lineError(errors, paymentIndex, lineIndex, field);
  const storeOptions = useMemo<SearchableSelectOption[]>(
    () =>
      stores.map((store) => ({
        value: String(store.id),
        label: store.storeNumber,
        hint: store.name,
      })),
    [stores]
  );

  return (
    <div
      // space-y-4 between the groups below, which each carry their own
      // internal 12px. Everything was 12px before, so the location, the hours,
      // the money and the paperwork all ran together into one column.
      className="space-y-4 rounded-md border bg-muted/30 p-3.5"
      onFocus={onFocusCapture}
    >
      <div className="flex items-center justify-between border-b pb-2.5">
        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Store {lineIndex + 1}
        </h5>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            disabled={disabled}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Location: a replicated store OR a free-text location. */}
      <PayFieldset legend="Where" tone="quiet" className="border-t-0 pt-0">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Location type</Label>
          <Select
            value={line.locationKind}
            onValueChange={(v) =>
              // Clear the other field so the payload can never be ambiguous.
              onPatch(
                v === "store"
                  ? { locationKind: "store" as LineLocationKind, otherStore: "" }
                  : { locationKind: "other" as LineLocationKind, storeId: "" }
              )
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" style={{ maxHeight: 240, overflowY: "auto" }}>
              <SelectItem value="store">System store</SelectItem>
              <SelectItem value="other">Other location</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {line.locationKind === "store" ? (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Store <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              options={storeOptions}
              value={line.storeId || undefined}
              onChange={(v) => onPatch({ storeId: v })}
              disabled={disabled}
              placeholder="Select store"
              searchPlaceholder="Search stores…"
              emptyText="No stores found."
              className={cn("h-9 text-sm", err("store_id") && "border-destructive")}
            />
            {err("store_id") && (
              <p className="text-[11px] text-destructive">{err("store_id")}</p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Location name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={line.otherStore}
              onChange={(e) => onPatch({ otherStore: e.target.value })}
              placeholder="e.g. Warehouse, supplier depot…"
              disabled={disabled}
              className={cn("h-9 text-sm", err("other_store") && "border-destructive")}
            />
            {err("other_store") ? (
              <p className="text-[11px] text-destructive">{err("other_store")}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                A place outside the store list.
              </p>
            )}
          </div>
        )}
      </div>
      </PayFieldset>

      <PayFieldset legend="Pay for this store" tone="quiet">
      <DailyPayLabourControl
        payShape={payShape}
        paymentRate={paymentRate}
        dayPrice={dayPrice}
        mode={line.labourMode}
        onModeChange={(labourMode) => onPatch({ labourMode })}
        hoursValue={line.totalWorkingHours}
        onHoursChange={(totalWorkingHours) => onPatch({ totalWorkingHours })}
        lumpSumValue={line.lumpSum}
        onLumpSumChange={(lumpSum) => onPatch({ lumpSum })}
        rateValue={line.hourlyPaymentRate}
        onRateChange={(hourlyPaymentRate) => onPatch({ hourlyPaymentRate })}
        gathered={line.gathered}
        disabled={disabled}
        hoursError={err("total_working_hours")}
        lumpSumError={err("lump_sum")}
        rateError={err("hourly_payment_rate")}
      />
      </PayFieldset>

      <PayFieldset legend="On top of the labour" tone="quiet">
      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyField
          label="Gas"
          value={line.gas}
          onChange={(gas) => onPatch({ gas })}
          disabled={disabled}
          error={err("gas")}
          hint="This store's fuel."
        />
        <MoneyField
          label="Additional owed"
          value={line.moneyOwed}
          onChange={(moneyOwed) => onPatch({ moneyOwed })}
          disabled={disabled}
          error={err("money_owed")}
          hint="An extra amount on top — not a total."
        />
      </div>
      </PayFieldset>

      {/* Linked ticket issues -- the payee must already be assigned to each.
          NOT folded, unlike the files and notes below it: this is what the
          hours gather from, so hiding it would hide the reason a store line
          came out at zero. */}
      <PayFieldset legend="Linked ticket issues" tone="quiet">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Linked ticket issues (optional)
        </Label>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={disabled || !!issuePickerDisabledReason}
            title={issuePickerDisabledReason}
            onClick={onOpenIssuePicker}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Browse tickets
          </Button>
          {line.ticketIssueIds.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pe-1 text-xs">
              #{id}
              <button
                type="button"
                className="ms-0.5 rounded-sm opacity-60 hover:opacity-100"
                onClick={() =>
                  onPatch({
                    ticketIssueIds: line.ticketIssueIds.filter((x) => x !== id),
                  })
                }
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {line.ticketIssueIds.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              None selected — hours will gather as zero.
            </span>
          )}
        </div>
        {err("ticket_issue_ids") && (
          <p className="text-[11px] text-destructive">{err("ticket_issue_ids")}</p>
        )}
      </div>
      </PayFieldset>

      {/* Files and notes: optional, and on most store lines empty. Folded,
          with the count on the tab so a line that does carry one still says so
          without being opened. */}
      <PayFoldout
        label="Attachments and notes"
        icon={Paperclip}
        count={line.files.length + line.notes.length}
      >
      <div className="space-y-1.5">
        <Label className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" />
            Attachments (optional)
          </span>
          <span className="text-[10px] opacity-60">Ctrl+V to paste</span>
        </Label>
        <Input
          type="file"
          multiple
          onChange={(e) =>
            onPatch({ files: [...line.files, ...Array.from(e.target.files ?? [])] })
          }
          disabled={disabled}
          className="h-9 text-sm"
        />
        {line.files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {line.files.map((f, fi) => (
              <span
                key={fi}
                className="inline-flex items-center gap-1 rounded border bg-card px-1.5 py-0.5 text-xs"
              >
                {f.name}
                <button
                  type="button"
                  className="ms-0.5 rounded-sm opacity-60 hover:opacity-100"
                  onClick={() =>
                    onPatch({ files: line.files.filter((_, idx) => idx !== fi) })
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
        notes={line.notes}
        onChange={(notes) => onPatch({ notes })}
        disabled={disabled}
        label="No notes on this store."
      />
      </PayFoldout>
    </div>
  );
}
