"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface StoreNavItem {
  /** Unique selection key. */
  key: string;
  /** Short label shown on the pill, e.g. "20". */
  code: string;
  /** Full label — used for search, tooltip and the detail header. */
  label: string;
  /** Optional count badge (e.g. employees, feedback items). */
  badge?: number;
  /** Dim the pill when the store has no data in this domain. */
  muted?: boolean;
}

interface StoreNavProps {
  items: StoreNavItem[];
  /** Selected key, or "all". */
  value: string;
  onChange: (value: string) => void;
  allowAll?: boolean;
  /** Label for the "all" row. */
  allLabel?: string;
  className?: string;
}

/**
 * Vertical, scrollable store picker sidebar so users can jump straight to a
 * store from a master-detail layout. Includes a search filter and optional
 * per-store count badges. "All Stores" stays pinned above the scroll region.
 */
export function StoreNav({
  items,
  value,
  onChange,
  allowAll = true,
  allLabel = "All Stores",
  className,
}: StoreNavProps) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border bg-card p-2 lg:w-60 lg:shrink-0",
        className,
      )}
    >
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a store…"
          className="h-8 ps-8 text-sm"
        />
      </div>

      {allowAll && (
        <Row
          active={value === "all"}
          onClick={() => onChange("all")}
          label={allLabel}
        />
      )}

      <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto pe-1 lg:max-h-[600px]">
        {filtered.map((it) => (
          <Row
            key={it.key}
            active={value === it.key}
            muted={it.muted}
            onClick={() => onChange(it.key)}
            label={it.label}
            badge={it.badge}
          />
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            No matching store
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  active,
  muted,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  muted?: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
        muted && !active && "opacity-45",
      )}
    >
      <span className="truncate">{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-primary-foreground/20" : "bg-muted-foreground/15",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
