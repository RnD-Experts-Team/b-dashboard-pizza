"use client";

import { useState } from "react";
import { FolderTree, Layers, ShieldCheck, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { AssignmentsPanel } from "./assignments-panel";
import { CoveragePanel } from "./coverage-panel";
import { LevelsPanel } from "./levels-panel";
import { SectionsPanel } from "./sections-panel";

type AdminTab = "sections" | "levels" | "assignments" | "coverage";

const TABS: { id: AdminTab; icon: typeof Layers }[] = [
  { id: "sections", icon: Layers },
  { id: "levels", icon: FolderTree },
  { id: "assignments", icon: UserCheck },
  { id: "coverage", icon: ShieldCheck },
];

/**
 * The routing catalogue: sections (what pages post), levels (groupings over
 * sections) and assignments (who owns which). Not gated in the UI — every
 * route here is gated upstream by `administer tickets`, and each panel shows
 * that 403 as its own card.
 */
export function TicketsAdmin({ onCatalogChanged }: { onCatalogChanged: () => void }) {
  const t = useTranslations("toolboxTickets.admin");
  const [tab, setTab] = useState<AdminTab>("sections");

  return (
    <div className="space-y-4" data-slot="tickets-admin">
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="inline-flex w-max gap-1 rounded-lg border bg-muted/40 p-1" role="tablist">
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(`tabs.${id}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t(`intro.${tab}`)}</p>

      {tab === "sections" && <SectionsPanel onChanged={onCatalogChanged} />}
      {tab === "levels" && <LevelsPanel onChanged={onCatalogChanged} />}
      {tab === "assignments" && <AssignmentsPanel />}
      {tab === "coverage" && <CoveragePanel onChanged={onCatalogChanged} />}
    </div>
  );
}
