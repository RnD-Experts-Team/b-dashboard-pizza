"use client";

import { RotateCcw } from "lucide-react";
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
import { formatHours, payableHours } from "@/lib/daily-pay/money";
import type { LineLabourMode } from "@/lib/daily-pay/entry-form-state";
import type { DailyPayGathered } from "@/types/daily-pay.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  How a line's labour is worked out — three mutually exclusive modes        */
/*                                                                            */
/*  This control exists so the choice is EXPLICIT rather than an emergent     */
/*  property of whether an input happens to be empty. The backend treats a    */
/*  missing total_working_hours as "gather from attendance" and a present one */
/*  — INCLUDING 0 — as a permanent override, so an ambiguous UI here would    */
/*  silently change what somebody gets paid.                                  */
/*                                                                            */
/*  A Select rather than a toggle group because components/ui has no          */
/*  toggle-group primitive and that directory is Core.                        */
/* ────────────────────────────────────────────────────────────────────────── */

const MODE_LABEL: Record<LineLabourMode, string> = {
  gather: "Gathered from attendance",
  hours: "Override hours",
  lumpSum: "Lump sum",
};

interface DailyPayLabourControlProps {
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

export function DailyPayLabourControl({
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
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Labour</Label>
        <Select
          value={mode}
          onValueChange={(v) => onModeChange(v as LineLabourMode)}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="gather">{MODE_LABEL.gather}</SelectItem>
            <SelectItem value="hours">{MODE_LABEL.hours}</SelectItem>
            <SelectItem value="lumpSum">{MODE_LABEL.lumpSum}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "lumpSum" ? (
        /* A lump sum REPLACES hourly labour, so hours and rate unmount —
           leaving them visible is how users double-charge in their heads. */
        <div className="sm:col-span-2">
          <MoneyField
            label="Lump sum"
            value={lumpSumValue}
            onChange={onLumpSumChange}
            disabled={disabled}
            error={lumpSumError}
            hint="Replaces hourly labour for this line."
            required
          />
        </div>
      ) : (
        <>
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
                placeholder={payable != null ? formatHours(payable) : "Gathered on save"}
                hint={
                  breakdown ??
                  "Pulled from the attendance entries clocked against the linked issues."
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
                      ? `Gathered ${formatHours(payable)} — yours replaces it.`
                      : "This value replaces the gathered hours, permanently."
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
                    Use gathered
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
            hint="Falls back to the payment's rate."
          />
        </>
      )}
    </div>
  );
}
