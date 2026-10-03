"use client";

import type { ReactNode } from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * A small segmented switch: a few options, exactly one chosen.
 *
 * Built on Radix `ToggleGroup`, so it gets a roving tab stop and arrow-key
 * movement for free, which the hand-rolled radio buttons it replaces never had.
 * Dressed like the DSPR dashboard's switches (`rounded-md bg-muted/60 p-0.5`,
 * the chosen one lifted onto `bg-background`). `components/ui` is Core, so this
 * lives with the scheduling components, the same way `delayed-tooltip.tsx` does.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** What the switch chooses, for screen readers. */
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix reports "" when the chosen option is pressed again. A switch
      // always has an answer, so that press changes nothing.
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      aria-label={label}
      className={cn("inline-flex gap-0.5 rounded-md bg-muted/60 p-0.5", className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className="flex items-center gap-1 rounded px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {option.icon}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
