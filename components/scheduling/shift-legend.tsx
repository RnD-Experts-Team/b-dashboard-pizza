"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SHIFT_ACCENT, type ShiftTone } from "@/lib/scheduling/accents";

/**
 * What the colours mean.
 *
 * The grid carries real meaning in three accents plus a bare state, and until
 * now nothing on screen said so — a manager had to hover each card to find out.
 *
 * The swatches are built from `SHIFT_ACCENT[...].rail`, the exact class the
 * cards use, rather than a hand-picked approximation. Same rule the cleaning
 * grid's legend follows: the legend mark and the cell mark must be the same
 * mark, or the legend teaches something subtly untrue.
 */

const ROWS: { tone: ShiftTone; label: string; where: string }[] = [
  { tone: "success", label: "Worked as planned", where: "Actual · Compare" },
  {
    tone: "attention",
    label: "Needs a look — times changed, or scheduled over a block",
    where: "All views",
  },
  { tone: "critical", label: "A problem — no-show, or overlapping shifts", where: "All views" },
  { tone: "info", label: "Worked without being planned", where: "Actual · Compare" },
  { tone: "neutral", label: "Nothing to flag", where: "All views" },
];

export function ShiftLegend() {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              aria-label="What the colours mean"
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          What the colours mean
        </TooltipContent>
      </Tooltip>

      <PopoverContent align="start" className="w-72 p-3 text-xs">
        <p className="font-semibold">What the colours mean</p>
        <p className="mt-0.5 text-muted-foreground">
          The bar down the leading edge of a shift.
        </p>

        <ul className="mt-2.5 space-y-2">
          {ROWS.map((row) => (
            <li key={row.tone} className="flex items-start gap-2">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 h-3.5 w-1 shrink-0 rounded-full",
                  // `neutral` has no rail at all — show the absence honestly
                  // rather than inventing a grey bar the grid never draws.
                  row.tone === "neutral"
                    ? "border border-dashed border-muted-foreground/40"
                    : SHIFT_ACCENT[row.tone].rail,
                )}
              />
              <span className="min-w-0 flex-1 leading-tight">
                {row.label}
                <span className="block text-[10px] text-muted-foreground">
                  {row.where}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-start gap-2 border-t pt-2.5">
          <span className="mt-0.5 shrink-0 rounded-sm border border-current px-0.5 text-[8px] font-bold leading-[1.4] tracking-tight text-muted-foreground">
            C
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            Recorded by the time clock
            <span className="block text-[10px] text-muted-foreground">
              Anything without it was entered by hand
            </span>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
