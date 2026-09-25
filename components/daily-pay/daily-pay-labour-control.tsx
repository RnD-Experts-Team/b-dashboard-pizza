"use client";

import { Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HoursField, MoneyField } from "./daily-pay-num-field";
import { OverriddenByFixedAmount } from "./pay-shape-picker";
import { formatHours, formatMoney, formatRate, payableHours } from "@/lib/daily-pay/money";
import {
  toNum,
  type LineLabourMode,
  type PaymentPayShape,
} from "@/lib/daily-pay/entry-form-state";
import type { DailyPayGathered } from "@/types/daily-pay.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  How one store's labour is worked out                                      */
/*                                                                            */
/*  The PAYMENT decides the shape (see PayShapePicker); this box follows it:  */
/*                                                                            */
/*   hourly        the store picks logged hours or typed hours, × a rate.     */
/*                 "A fixed price" is listed but greyed, with how to get it.  */
/*   mixed         the same box, with "A fixed price" live: each store picks. */
/*   fixedPerStore the store's price is the only input; hours and rate are    */
/*                 locked, and say so.                                        */
/*   fixedDay      the whole box is dimmed: the day's price covers it and     */
/*                 nothing typed here can change the pay.                     */
/*                                                                            */
/*  The choice is EXPLICIT rather than an emergent property of whether an     */
/*  input happens to be empty. The backend treats a missing                   */
/*  total_working_hours as "gather from attendance" and a present one —       */
/*  INCLUDING 0 — as a permanent override, so an ambiguous UI here would      */
/*  silently change what somebody gets paid.                                  */
/*                                                                            */
/*  A Select rather than a toggle group because components/ui has no          */
/*  toggle-group primitive and that directory is Core.                        */
/* ────────────────────────────────────────────────────────────────────────── */

/*
 * Plain words. "Override hours" is a database concept; "type the hours in
 * myself" is what the person is doing.
 */
const MODE_LABEL: Record<LineLabourMode, string> = {
  gather: "Use the hours that were logged",
  hours: "Type the hours in myself",
  lumpSum: "A fixed price for this store",
};

/** Said under the picker, because the consequence is the part that bites:
 *  typing hours stops the line ever updating again. */
const MODE_CONSEQUENCE: Record<LineLabourMode, string> = {
  gather:
    "Taken from the attendance recorded against these jobs, and kept up to date if more is logged.",
  hours:
    "Recalculating will leave this store alone from now on. Switch back to the logged hours to undo that.",
  lumpSum: "An agreed price. The hours and the rate are not used at all.",
};

interface DailyPayLabourControlProps {
  /** The payment's choice. Decides which of the controls below are live. */
  payShape: PaymentPayShape;
  /** The payment's default rate, as typed -- shown as what an empty rate means. */
  paymentRate: string;
  /** The payment's price for the day, as typed -- named in the fixedDay banner. */
  dayPrice: string;
  mode: LineLabourMode;
  onModeChange: (mode: LineLabourMode) => void;
  hoursValue: string;
  onHoursChange: (v: string) => void;
  lumpSumValue: string;
  onLumpSumChange: (v: string) => void;
  rateValue: string;
  onRateChange: (v: string) => void;
  /** Edit mode only — the frozen figures behind the placeholder. */
  gathered: DailyPayGathered | null;
  disabled?: boolean;
  hoursError?: string;
  lumpSumError?: string;
  rateError?: string;
}

export function DailyPayLabourControl(props: DailyPayLabourControlProps) {
  if (props.payShape === "fixedDay") return <CoveredByDay {...props} />;
  if (props.payShape === "fixedPerStore") return <PricePerStore {...props} />;
  return <Hourly {...props} />;
}

/* ── Paid by the hour (and "store by store") ──────────────────────────────── */

function Hourly({
  payShape,
  paymentRate,
  mode,
  onModeChange,
  hoursValue,
  onHoursChange,
  lumpSumValue,
  onLumpSumChange,
  rateValue,
  onRateChange,
  gathered,
  disabled,
  hoursError,
  lumpSumError,
  rateError,
}: DailyPayLabourControlProps) {
  const payable = payableHours(gathered);
  const defaultRate = toNum(paymentRate);
  // "Store by store" is the one shape where this store chooses for itself.
  const allowFixed = payShape === "mixed";

  if (mode === "lumpSum" && allowFixed) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <ModePicker mode={mode} onModeChange={onModeChange} disabled={disabled} allowFixed />
        <div className="sm:col-span-2">
          <MoneyField
            label="Price for this store"
            value={lumpSumValue}
            onChange={onLumpSumChange}
            disabled={disabled}
            error={lumpSumError}
            hint={
              payable != null
                ? `The whole pay for this store. The ${formatHours(payable)} logged hours are kept as a record, not paid.`
                : "The whole pay for this store. Logged hours are kept as a record, not paid."
            }
            required
          />
        </div>
      </div>
    );
  }

  // Defensive: a fixed store on a plain hourly payment. Switching to hourly
  // resets these, so it should not happen -- but if it does, show it with the
  // way out rather than silently converting it.
  if (mode === "lumpSum") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <ModePicker mode={mode} onModeChange={onModeChange} disabled={disabled} />
        <div className="space-y-1.5 sm:col-span-2">
          <MoneyField
            label="Fixed price"
            value={lumpSumValue}
            onChange={onLumpSumChange}
            disabled={disabled}
            error={lumpSumError}
            hint="An hourly payment cannot pay a store a fixed price."
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onModeChange("gather")}
            disabled={disabled}
          >
            <RotateCcw className="h-3 w-3" />
            Pay this store its logged hours instead
          </Button>
        </div>
      </div>
    );
  }

  const breakdown = gathered
    ? [
        `Work ${formatHours(gathered.workHours)}`,
        `Travel ${formatHours(gathered.travelHours)}`,
        `Parts run ${formatHours(gathered.partsRunHours)}`,
        `Break ${formatHours(gathered.breakHours)} (unpaid)`,
      ].join(" · ")
    : null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <ModePicker
        mode={mode}
        onModeChange={onModeChange}
        disabled={disabled}
        allowFixed={allowFixed}
      />

      <div className="space-y-1">
        {mode === "gather" ? (
          /* Disabled, with the gathered figure as a PLACEHOLDER only.
             Putting it in the value would send it on the next save and
             turn a self-updating gathered line into a permanent override. */
          <HoursField
            label="Working hours"
            value=""
            onChange={() => {}}
            disabled
            placeholder={payable != null ? formatHours(payable) : "Counted on save"}
            hint={
              breakdown ??
              "Counted from the attendance clocked against the linked issues when you save."
            }
          />
        ) : (
          <div className="space-y-1">
            <HoursField
              label="Working hours"
              value={hoursValue}
              onChange={onHoursChange}
              disabled={disabled}
              error={hoursError}
              hint={
                payable != null
                  ? `Logged ${formatHours(payable)} — yours replaces it.`
                  : "This value replaces the logged hours, permanently."
              }
              required
            />
            {payable != null && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"
                onClick={() => {
                  onModeChange("gather");
                  onHoursChange("");
                }}
                disabled={disabled}
              >
                <RotateCcw className="h-3 w-3" />
                Use logged hours
              </Button>
            )}
          </div>
        )}
      </div>

      <MoneyField
        label="Hourly rate"
        value={rateValue}
        onChange={onRateChange}
        disabled={disabled}
        error={rateError}
        placeholder={defaultRate != null ? defaultRate.toFixed(2) : undefined}
        hint={
          toNum(rateValue) != null
            ? "This store's own rate — used instead of the payment's."
            : defaultRate != null
              ? `Empty uses the payment's ${formatRate(defaultRate)}/h.`
              : "Empty, and the payment has no default rate either."
        }
      />
    </div>
  );
}

/* ── A price per store ────────────────────────────────────────────────────── */

function PricePerStore({
  lumpSumValue,
  onLumpSumChange,
  gathered,
  disabled,
  lumpSumError,
}: DailyPayLabourControlProps) {
  const payable = payableHours(gathered);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <LockedBy
        value={MODE_LABEL.lumpSum}
        reason="Set by the payment: “A price per store”."
      />
      <div className="space-y-1 sm:col-span-2">
        <MoneyField
          label="Price for this store"
          value={lumpSumValue}
          onChange={onLumpSumChange}
          disabled={disabled}
          error={lumpSumError}
          hint={
            payable != null
              ? `The whole pay for this store. The ${formatHours(payable)} logged hours are kept as a record, not paid.`
              : "The whole pay for this store. Logged hours are kept as a record, not paid."
          }
          required
        />
      </div>
    </div>
  );
}

/* ── Covered by the day's price ───────────────────────────────────────────── */

function CoveredByDay({ dayPrice, mode, hoursValue, gathered }: DailyPayLabourControlProps) {
  const payable = payableHours(gathered);
  const price = toNum(dayPrice);

  return (
    <OverriddenByFixedAmount
      active
      reason={
        <span className="flex items-center gap-1.5">
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
          {price != null
            ? `Covered by the day's price of ${formatMoney(price)} — nothing here changes the pay.`
            : "Covered by the day's price — nothing here changes the pay."}{" "}
          The hours are kept as a record only.
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <LockedBy value={MODE_LABEL[mode === "lumpSum" ? "gather" : mode]} />
        <HoursField
          label="Working hours (record only)"
          value={mode === "hours" ? hoursValue : ""}
          onChange={() => {}}
          disabled
          placeholder={payable != null ? formatHours(payable) : "Counted on save"}
        />
        <MoneyField label="Hourly rate" value="" onChange={() => {}} disabled placeholder="—" />
      </div>
    </OverriddenByFixedAmount>
  );
}

/* ── Shared bits ──────────────────────────────────────────────────────────── */

function ModePicker({
  mode,
  onModeChange,
  disabled,
  allowFixed = false,
}: {
  mode: LineLabourMode;
  onModeChange: (mode: LineLabourMode) => void;
  disabled?: boolean;
  /** Only under "Store by store" can a store pick a fixed price itself. */
  allowFixed?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">How this store is paid</Label>
      <Select
        value={mode}
        onValueChange={(v) => onModeChange(v as LineLabourMode)}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" style={{ maxHeight: 280, overflowY: "auto" }}>
          <SelectItem value="gather">{MODE_LABEL.gather}</SelectItem>
          <SelectItem value="hours">{MODE_LABEL.hours}</SelectItem>
          {/* On a plain hourly payment: listed, greyed, with how to get it --
              not removed. Mixing is a payment-level decision ("Store by
              store"), so a store cannot drift into it by itself. */}
          {allowFixed ? (
            <SelectItem value="lumpSum">{MODE_LABEL.lumpSum}</SelectItem>
          ) : (
            <SelectItem value="lumpSum" disabled>
              <span className="flex flex-col items-start">
                <span>{MODE_LABEL.lumpSum}</span>
                <span className="text-[10px] text-muted-foreground">
                  Choose “Store by store” on the payment to use this
                </span>
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      <p className="text-[11px] leading-snug text-muted-foreground">{MODE_CONSEQUENCE[mode]}</p>
    </div>
  );
}

/** A picker the payment has decided for this store: shown, locked, and why. */
function LockedBy({ value, reason }: { value: string; reason?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">How this store is paid</Label>
      <div className="flex h-9 items-center gap-1.5 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
        <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{value}</span>
      </div>
      {reason && <p className="text-[11px] leading-snug text-muted-foreground">{reason}</p>}
    </div>
  );
}
