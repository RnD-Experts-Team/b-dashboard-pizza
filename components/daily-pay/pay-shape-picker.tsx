"use client";

import { Clock, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PayShape } from "@/lib/daily-pay/explain";

/**
 * How is this payee paid? Asked first, before anything else.
 *
 * There are two genuinely different processes crammed into this one screen: our
 * own technicians, paid by the hour, every working day; and outside companies,
 * paid a fixed amount per job. They share every field, and the result is the
 * worst trap in the feature -- typing a lump sum silently switches the hours
 * and rate off, while both stay on screen looking like they count.
 *
 * Forking here removes that by construction rather than by explanation. On the
 * fixed side the hours block is still rendered, dimmed, saying it does not
 * count: hiding it would leave someone who typed six hours wondering where they
 * went, and "nothing hidden" is the rule for this whole feature.
 */

interface PayShapePickerProps {
  value: PayShape;
  onChange: (shape: PayShape) => void;
  disabled?: boolean;
  className?: string;
}

const SHAPES: Array<{
  id: PayShape;
  label: string;
  description: string;
  icon: typeof Clock;
}> = [
  {
    id: "hourly",
    label: "By the hour",
    description: "Our own technicians. Hours come from what was logged on the tickets.",
    icon: Clock,
  },
  {
    id: "fixed",
    label: "A fixed amount",
    description: "An agreed price for the job, usually an outside company. Hours do not count.",
    icon: Banknote,
  },
];

export function PayShapePicker({
  value,
  onChange,
  disabled = false,
  className,
}: PayShapePickerProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs text-muted-foreground">How is this one paid?</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SHAPES.map((shape) => {
          const Icon = shape.icon;
          const isActive = value === shape.id;
          return (
            <button
              key={shape.id}
              type="button"
              disabled={disabled}
              aria-pressed={isActive}
              onClick={() => onChange(shape.id)}
              className={cn(
                "flex h-full flex-col items-start gap-0.5 rounded-lg border p-3 text-start transition-colors",
                isActive
                  ? "border-primary bg-primary/10"
                  : "bg-card hover:border-primary/50 hover:bg-accent",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {shape.label}
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">
                {shape.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The wrapper that dims a block a fixed amount has switched off.
 *
 * Not `display: none`. The fields stay readable and the banner says why they do
 * not count -- that is how the rule gets learned, and it is the only honest way
 * to show someone that the six hours they typed are being ignored.
 */
export function OverriddenByFixedAmount({
  active,
  children,
  className,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!active) return <>{children}</>;

  return (
    <div className={cn("relative rounded-lg border border-dashed p-3", className)}>
      <p className="mb-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        Not used — the fixed amount replaces this
      </p>
      <div className="pointer-events-none opacity-50">{children}</div>
    </div>
  );
}
