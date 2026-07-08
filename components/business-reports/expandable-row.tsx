"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tracks which rows (by key) are expanded, for tables with many drill-down rows. */
export function useExpandedRows() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const isExpanded = (key: string) => expanded.has(key);

  return { isExpanded, toggle };
}

/** Rotating chevron toggle button for an expandable table row. Detail content should only mount when `expanded` is true, so collapsed rows stay cheap. */
export function ExpandChevronButton({
  expanded,
  onClick,
  label,
}: {
  expanded: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={label ?? (expanded ? "Collapse row" : "Expand row")}
      className="mr-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground align-middle hover:bg-muted hover:text-foreground"
    >
      <ChevronRight
        className={cn("h-3.5 w-3.5 transition-transform duration-150", expanded && "rotate-90")}
      />
    </button>
  );
}
