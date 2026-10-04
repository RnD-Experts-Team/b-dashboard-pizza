"use client";

import { useCallback } from "react";
import { LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { inSheet, startBlocker, waitForSheetClosed } from "@/lib/report-problem/guard";
import { useReportProblem } from "@/lib/store/report-problem.store";
import { useUIStore } from "@/lib/store/ui.store";

/**
 * Starts inspect mode from a trigger button — or explains why it can't.
 * From inside a sheet (the topnav hamburger menu) the sheet is closed first,
 * and inspect mode starts once Radix has fully let go of the page.
 */
function useStartReport() {
  const t = useTranslations("reportProblem.trigger");
  const start = useReportProblem((s) => s.start);

  return useCallback(
    async (trigger: HTMLElement, closeSheet?: () => void) => {
      if (inSheet(trigger)) {
        closeSheet?.();
        await waitForSheetClosed();
        trigger = document.body; // the sheet (and the button in it) is gone
      }
      const block = startBlocker(trigger === document.body ? null : trigger);
      if (block) {
        // A modal or fullscreen view owns the screen; "small" can't happen
        // (the triggers are hidden below md) but is covered anyway.
        toast.info(t(`blocked.${block}`));
        return;
      }
      start();
    },
    [start, t],
  );
}

/** Replaces the old external "Support" link at the bottom of the sidebar. */
export function ReportProblemSidebarButton({
  collapsed,
  onBeforeStart,
}: {
  collapsed?: boolean;
  /** Closes the drawer when the sidebar is rendered inside one. */
  onBeforeStart?: () => void;
}) {
  const t = useTranslations("reportProblem.trigger");
  const startReport = useStartReport();

  return (
    // Tablets and up only for now — hidden in the phone drawer.
    <div className="hidden md:block" data-slot="report-problem-sidebar">
      <div className={cn("px-2 py-2 sm:px-3", collapsed && "flex justify-center")}>
        <button
          type="button"
          onClick={(e) => void startReport(e.currentTarget, onBeforeStart)}
          title={collapsed ? t("label") : undefined}
          aria-label={t("label")}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-2",
          )}
        >
          <LifeBuoy className="h-5 w-5 shrink-0 text-muted-foreground" />
          {!collapsed && <span className="truncate">{t("label")}</span>}
        </button>
      </div>
      <Separator />
    </div>
  );
}

/** Top-nav layout has no desktop sidebar — the trigger lives in the top bar there. */
export function ReportProblemTopbarButton() {
  const t = useTranslations("reportProblem.trigger");
  const layoutVariant = useUIStore((s) => s.layoutVariant);
  const startReport = useStartReport();
  if (layoutVariant !== "topnav") return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="hidden h-9 w-9 md:inline-flex"
      aria-label={t("label")}
      title={t("label")}
      onClick={(e) => void startReport(e.currentTarget)}
    >
      <LifeBuoy className="h-4 w-4" />
    </Button>
  );
}
