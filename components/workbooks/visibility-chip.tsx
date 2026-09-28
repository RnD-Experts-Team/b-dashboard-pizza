"use client";

import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { tagGrantsEdit, visibilityAccent } from "./visibility-accent";

interface VisibilityChipProps {
  value: string;
  /** Always the server's label — never derived here. */
  label: string;
  roles?: string[] | null;
  grantsEdit?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** The tag, as a dash + label chip (maintenance-tickets StatusChip shape). */
export function VisibilityChip({
  value,
  label,
  roles,
  grantsEdit,
  size = "sm",
  className,
}: VisibilityChipProps) {
  const accent = visibilityAccent(value);
  const Icon = tagGrantsEdit(value, grantsEdit) ? Pencil : Eye;

  const chip = (
    <span
      data-slot="visibility-chip"
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border bg-card",
        size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1",
        className,
      )}
    >
      <span className={cn("w-1 shrink-0 rounded-full", size === "sm" ? "h-2.5" : "h-3", accent.bar)} />
      <Icon className={cn("h-3 w-3 shrink-0", accent.text)} aria-hidden="true" />
      <span
        className={cn(
          "min-w-0 truncate font-semibold",
          size === "sm" ? "text-[10px]" : "text-[11px]",
          accent.text,
        )}
      >
        {label}
      </span>
      {roles && roles.length > 0 && (
        <span className="shrink-0 rounded bg-muted px-1 text-[10px] tabular-nums text-muted-foreground">
          {roles.length}
        </span>
      )}
    </span>
  );

  if (!roles || roles.length === 0) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent side="top">{roles.join(", ")}</TooltipContent>
    </Tooltip>
  );
}
