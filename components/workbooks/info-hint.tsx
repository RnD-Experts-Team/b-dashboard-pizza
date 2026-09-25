"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface InfoRow {
  label: string;
  value: string | null | undefined;
}

interface InfoHintProps {
  rows: InfoRow[];
  className?: string;
}

/**
 * An (i) that reveals secondary details — who made it, at which store, when —
 * instead of spelling them out on every card. Opens on hover and focus like
 * any tooltip, and ALSO toggles on tap, because touch screens have no hover.
 */
export function InfoHint({ rows, className }: InfoHintProps) {
  const t = useTranslations("workbooks.info");
  const [open, setOpen] = useState(false);
  const shown = rows.filter((r) => r.value);
  if (shown.length === 0) return null;

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-slot="info-hint"
          onClick={(e) => {
            // Inside clickable cards: show the details, don't open the card.
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label={t("label")}
        >
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs px-3 py-2">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-start text-xs">
          {shown.map((r) => (
            <div key={r.label} className="contents">
              <dt className="opacity-70">{r.label}</dt>
              <dd className="break-words font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
      </TooltipContent>
    </Tooltip>
  );
}
