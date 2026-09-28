"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Numeric form fields shared by the payment and line levels                */
/*                                                                            */
/*  Extracted from the old single-file dialog so the payment card, the line   */
/*  fieldset and the labour control all render an identical control. The `$`  */
/*  prefix uses logical properties (start-2.5 / ps-6) so it lands on the      */
/*  correct side in RTL.                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

interface NumFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  step?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Server or client validation message for this exact field. */
  error?: string;
  /** Muted caption under the input. Suppressed while an error is showing. */
  hint?: string;
  required?: boolean;
}

export function NumField({
  label,
  value,
  onChange,
  prefix,
  step = "0.01",
  disabled,
  placeholder = "0",
  error,
  hint,
  required,
}: NumFieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="ms-0.5 text-destructive">*</span>}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "h-9 text-sm tabular-nums",
            prefix && "ps-6",
            error && "border-destructive focus-visible:ring-destructive/30"
          )}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : (
        hint && <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Money: two decimal places and a currency prefix. */
export function MoneyField(props: Omit<NumFieldProps, "prefix" | "step">) {
  return <NumField {...props} prefix="$" step="0.01" placeholder={props.placeholder ?? "0.00"} />;
}

/** Hours: quarter-hour steps, since that is how shifts are recorded. */
export function HoursField(props: Omit<NumFieldProps, "prefix" | "step">) {
  return <NumField {...props} step="0.25" />;
}
