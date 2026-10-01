"use client";

import * as React from "react";
import { Tooltip as UiTooltip } from "@/components/ui/tooltip";

/**
 * How long the pointer has to rest on something in the scheduling views before
 * its hover card opens. Raise it for calmer hovering, lower it for snappier.
 *
 * Why this file exists: `components/ui/tooltip.tsx` wraps every `Tooltip` in its
 * own `TooltipProvider` with `delayDuration = 0`, and the nearest provider wins.
 * So a delay set on an outer `TooltipProvider` (this page used to set 200) never
 * reached the tooltips below it, and every one of them opened instantly. The
 * only delay that counts is the one on the `Tooltip` itself. `ui/` is Core, so
 * the default is applied here instead, and the scheduling components import
 * their tooltip parts from this file rather than from `@/components/ui/tooltip`.
 */
export const TOOLTIP_DELAY_MS = 600;

export function Tooltip({
  delayDuration = TOOLTIP_DELAY_MS,
  ...props
}: React.ComponentProps<typeof UiTooltip>) {
  return <UiTooltip delayDuration={delayDuration} {...props} />;
}

export {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
