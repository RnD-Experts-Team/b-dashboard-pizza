"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { standingOf } from "@/lib/maintenance-tickets/technician-ranking";
import type { Technician } from "@/types/maintenance-system";
import { TechnicianStandingBadges } from "./technician-standing";

/**
 * Pick technicians: a checkable list in the order given — pass the list from
 * `useTechnicians({ store, issueId, urgent })`, which the server has already
 * ranked (covers store → covers issue → emergency → call first → rating →
 * name) — each with its badges, category and phone. Deleted technicians are
 * left out. `single` makes it a one-choice picker (booking a technician).
 */
export function TechnicianCheckList({
  technicians,
  selected,
  onToggle,
  emptyText,
  searchable = false,
}: {
  technicians: Technician[];
  selected: number[];
  onToggle: (technicianId: number) => void;
  emptyText?: string;
  /** A search box over name, category and phone; the order stays as given. */
  searchable?: boolean;
}) {
  const t = useTranslations("maintenanceSystem.technicians");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const live = technicians
    .filter((tech) => !tech.deletedAt)
    .filter((tech) => !needle || [tech.name, tech.category?.name, tech.phone].some((v) => v?.toLowerCase().includes(needle)));

  return (
    <div className="rounded-md border bg-background">
      {searchable ? (
        <div className="relative border-b">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="w-full bg-transparent py-2 ps-8 pe-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      ) : null}
      <div className="max-h-56 divide-y overflow-y-auto">
      {live.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">{emptyText ?? t("none")}</p>
      ) : (
        live.map((tech) => {
          const isOn = selected.includes(tech.id);
          const secondary = [tech.category?.name, tech.phone].filter(Boolean).join(" · ");
          return (
            <button
              key={tech.id}
              type="button"
              onClick={() => onToggle(tech.id)}
              aria-pressed={isOn}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors hover:bg-muted/40",
                isOn && "bg-accent",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                  isOn ? "border-primary bg-primary" : "border-input",
                )}
              >
                {isOn && <span className="text-[9px] leading-none text-primary-foreground">&#10003;</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-xs font-medium">{tech.name}</span>
                  <TechnicianStandingBadges standing={standingOf(tech)} />
                </span>
                {secondary && (
                  <span className="block truncate text-[10px] text-muted-foreground" title={secondary}>
                    {secondary}
                  </span>
                )}
              </span>
            </button>
          );
        })
      )}
      </div>
    </div>
  );
}
