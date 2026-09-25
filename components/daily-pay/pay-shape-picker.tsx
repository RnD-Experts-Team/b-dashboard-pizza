"use client";

import { Banknote, Clock, Split, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentPayShape } from "@/lib/daily-pay/entry-form-state";

/**
 * How is this payee paid? Asked first, before anything else, as four options
 * that each carry their own field.
 *
 * There are four genuinely different ways people get paid on this screen, and
 * the API lets their fields be mixed freely -- which is how a lump sum came to
 * silently switch off hours that stayed on screen looking live, and how a
 * payment-level lump sum silently swallowed the stores' own prices. Asking the
 * question once, on the payment, and making every store follow the answer
 * removes those by construction rather than by explanation.
 *
 * Each option's field sits INSIDE the option, so "the rate belongs to paying by
 * the hour" is visible rather than learned. The options not chosen stay on
 * screen with their field greyed and a reason -- nothing hidden is the rule for
 * this whole area, and a greyed "$18.00 — not used" is how someone who switched
 * away sees their typed rate did not vanish, it just does not count.
 */

export interface PayShapeOption {
  id: PaymentPayShape;
  label: string;
  description: string;
  /** Who this is normally for, in the coordinator's words. */
  usualFor: string;
  icon: typeof Clock;
}

export const PAY_SHAPES: PayShapeOption[] = [
  {
    id: "hourly",
    label: "By the hour",
    description: "Each store pays its hours × a rate. Hours come from what was logged on the tickets.",
    usualFor: "Usually our own technicians.",
    icon: Clock,
  },
  {
    id: "fixedDay",
    label: "One price for the day",
    description:
      "One agreed amount covers every store. Hours do not count, and the price is not split between the stores.",
    usualFor: "Usually a company with a day rate.",
    icon: Banknote,
  },
  {
    id: "fixedPerStore",
    label: "A price per store",
    description:
      "Each store gets its own agreed amount. Hours do not count, and each store's cost comes out right.",
    usualFor: "Usually a company priced per job.",
    icon: Store,
  },
  {
    id: "mixed",
    label: "Store by store",
    description:
      "Each store is paid its own way — some by the hour, some at a fixed price. You choose on each store.",
    usualFor: "When one payee did hourly work at one store and a priced job at another.",
    icon: Split,
  },
];

export const PAY_SHAPE_LABEL: Record<PaymentPayShape, string> = {
  hourly: PAY_SHAPES[0].label,
  fixedDay: PAY_SHAPES[1].label,
  fixedPerStore: PAY_SHAPES[2].label,
  mixed: PAY_SHAPES[3].label,
};

interface PayShapePickerProps {
  value: PaymentPayShape;
  onChange: (shape: PaymentPayShape) => void;
  /** The field that belongs to each option, told whether it is the chosen one. */
  renderField: (shape: PaymentPayShape, active: boolean) => React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function PayShapePicker({
  value,
  onChange,
  renderField,
  disabled = false,
  className,
}: PayShapePickerProps) {
  return (
    <div className={className}>
      {/* The fieldset legend above already asks the question in words. */}
      <div
        role="radiogroup"
        aria-label="How is this one paid?"
        className="grid grid-cols-1 gap-2 md:grid-cols-2"
      >
        {PAY_SHAPES.map((shape) => {
          const Icon = shape.icon;
          const isActive = value === shape.id;
          return (
            <div
              key={shape.id}
              className={cn(
                "flex flex-col rounded-lg border transition-colors",
                // The chosen one is the bright, outlined card; the others sit
                // back. The other way round reads as "this one is switched off".
                isActive
                  ? "border-primary bg-card shadow-sm ring-1 ring-primary"
                  : "border-dashed bg-muted/40"
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={isActive}
                disabled={disabled}
                onClick={() => onChange(shape.id)}
                className={cn(
                  "flex flex-1 flex-col items-start gap-1 rounded-t-lg p-3 text-start transition-colors",
                  !isActive && "hover:bg-accent",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <span className="flex w-full items-center gap-2 text-sm font-medium">
                  {/* A drawn radio dot, so it reads as "pick one" at a glance. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      isActive ? "border-primary" : "border-muted-foreground/50"
                    )}
                  >
                    {isActive && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {shape.label}
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {shape.description}
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground/80 italic">
                  {shape.usualFor}
                </span>
              </button>

              <div className={cn("border-t p-3", !isActive && "border-dashed opacity-70")}>
                {renderField(shape.id, isActive)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The wrapper that dims a block a fixed price has switched off.
 *
 * Not `display: none`. The fields stay readable and the banner says why they do
 * not count -- that is how the rule gets learned, and it is the only honest way
 * to show someone that the six hours they typed are being ignored.
 */
export function OverriddenByFixedAmount({
  active,
  reason = "Not used — the fixed amount replaces this",
  children,
  className,
}: {
  active: boolean;
  reason?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  if (!active) return <>{children}</>;

  return (
    <div className={cn("relative rounded-lg border border-dashed p-3", className)}>
      <p className="mb-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        {reason}
      </p>
      <div className="pointer-events-none opacity-50" aria-disabled="true">
        {children}
      </div>
    </div>
  );
}
