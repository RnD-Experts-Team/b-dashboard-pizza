"use client";

import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { readRefusal } from "@/lib/workbooks/errors";
import type { Breadcrumb, EffectiveVisibility } from "@/types/workbooks.types";
import { useCappedText } from "./access-note";

/**
 * Why a `viewer.can` flag is false, in words: the capping ancestor when the
 * server named one, otherwise a plain "no permission". Never re-derived.
 */
export function useDenyReason() {
  const t = useTranslations("workbooks");
  const capped = useCappedText();
  return (
    allowed: boolean,
    effective: EffectiveVisibility | null | undefined,
    breadcrumb: Breadcrumb[] = [],
  ): string | null => {
    if (allowed) return null;
    return capped(effective?.cappedBy, breadcrumb) ?? t("capped.noPermission");
  };
}

/**
 * The words for a failed mutation, for toasts and form errors. A 403 gets
 * the capping ancestor appended ("… The folder “Openings” is set to This
 * store — can view …"); anything else is the server's own message.
 */
export function useErrorText() {
  const t = useTranslations("workbooks");
  const capped = useCappedText();
  return (err: unknown, breadcrumb: Breadcrumb[] = []): string => {
    const refusal = readRefusal(err);
    if (refusal) {
      const why = capped(refusal.cappedBy, breadcrumb);
      return why ? `${refusal.message} ${why}` : refusal.message;
    }
    return err instanceof Error && err.message ? err.message : t("errors.title");
  };
}

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * A Button that, when blocked, stays visible, goes disabled and explains why
 * on hover/focus. Disabled buttons swallow pointer events, so the tooltip
 * hangs off a wrapping span.
 */
export const GuardedButton = forwardRef<HTMLButtonElement, ButtonProps & { reason?: string | null }>(
  function GuardedButton({ reason, disabled, ...props }, ref) {
    if (!reason) return <Button ref={ref} disabled={disabled} {...props} />;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex cursor-not-allowed rounded-md">
            <Button ref={ref} disabled {...props} className={props.className} />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{reason}</TooltipContent>
      </Tooltip>
    );
  },
);

/** A menu item that, when blocked, stays listed and says why underneath. */
export function MenuRow({
  icon: Icon,
  label,
  reason,
  destructive,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  reason: string | null;
  destructive?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      disabled={Boolean(reason)}
      onSelect={() => onSelect()}
      className={cn("flex-col items-start gap-0.5", destructive && !reason && "text-destructive focus:text-destructive")}
    >
      <span className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", destructive && !reason && "text-destructive")} />
        {label}
      </span>
      {reason && <span className="ps-6 text-[10px] leading-snug text-muted-foreground">{reason}</span>}
    </DropdownMenuItem>
  );
}
