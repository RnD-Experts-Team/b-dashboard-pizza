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
  /** Label for the "all" pill. */
  allLabel?: string;
}

/**
 * Compact, horizontally-scrollable store picker so users can jump straight to
 * a store instead of scrolling a long vertical stack. Includes a search filter
 * and optional per-store count badges.
 */
export function StoreNav({
  items,
  value,
  onChange,
  allowAll = true,
  allLabel = "All Stores",
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
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-2 sm:flex-row sm:items-center">
      <div className="relative w-full sm:w-52 shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a store…"
          className="h-8 ps-8 text-sm"
        />
      </div>

      <div className="-mx-1 min-w-0 flex-1 overflow-x-auto px-1">
        <div className="flex w-max items-center gap-1">
          {allowAll && (
            <Pill
              active={value === "all"}
              onClick={() => onChange("all")}
              label={allLabel}
            />
          )}
          {filtered.map((it) => (
            <Pill
              key={it.key}
              active={value === it.key}
              muted={it.muted}
              onClick={() => onChange(it.key)}
              label={it.code}
              title={it.label}
              badge={it.badge}
            />
          ))}
          {filtered.length === 0 && (
            <span className="px-2 py-1 text-xs text-muted-foreground">
              No matching store
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({
  active,
  muted,
  onClick,
  label,
  title,
  badge,
}: {
  active: boolean;
  muted?: boolean;
  onClick: () => void;
  label: string;
  title?: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card hover:bg-muted",
        muted && !active && "opacity-45",
      )}
    >
      {label}
      {typeof badge === "number" && badge > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-primary-foreground/20" : "bg-muted-foreground/15",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
