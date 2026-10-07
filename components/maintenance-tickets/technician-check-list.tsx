"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useMaintenanceTicketsCatalogStore } from "@/lib/store/maintenance-tickets-catalog.store";
import { rankTechnicians } from "@/lib/maintenance-tickets/technician-ranking";
import type { CatalogTechnician } from "@/types/maintenance-tickets.types";
import { TechnicianStandingBadges } from "./technician-standing";

/**
 * Pick technicians to send: a checkable list, the one to call first for the
 * issue at the top, then the go-to, then by stars -- each with their badges,
 * trade, and the coordinator's note about them. Deleted technicians are left
 * out.
 *
 * Shared by assign, attach and change-technicians, which each used to render
 * their own copy of this list in name order.
 */
export function TechnicianCheckList({
  technicians,
  catalogIssueId,
  selected,
  onToggle,
  emptyText = "No technicians.",
}: {
  technicians: CatalogTechnician[];
  /** The catalog issue being worked on; null ranks on overall ratings only. */
  catalogIssueId: number | null;
  selected: number[];
  onToggle: (technicianId: number) => void;
  emptyText?: string;
}) {
  const abilities = useMaintenanceTicketsCatalogStore((s) => s.abilities);
  const ranked = useMemo(
    () => rankTechnicians(technicians.filter((tech) => !tech.deletedAt), abilities, catalogIssueId),
    [technicians, abilities, catalogIssueId]
  );

  return (
    <div className="max-h-48 divide-y overflow-y-auto rounded-md border bg-background">
      {ranked.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        ranked.map(({ technician: tech, standing }) => {
          const isOn = selected.includes(tech.id);
          const secondary = [tech.categoryName, standing.notes].filter(Boolean).join(" · ");
          return (
            <button
              key={tech.id}
              type="button"
              onClick={() => onToggle(tech.id)}
              aria-pressed={isOn}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-1.5 text-start text-sm transition-colors hover:bg-muted/40",
                isOn && "bg-accent"
              )}
            >
              <div
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                  isOn ? "border-primary bg-primary" : "border-input"
                )}
              >
                {isOn && <span className="text-[9px] leading-none text-primary-foreground">&#10003;</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-medium">{tech.name}</p>
                  <TechnicianStandingBadges standing={standing} />
                </div>
                {secondary && <p className="truncate text-[10px] text-muted-foreground" title={secondary}>{secondary}</p>}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
