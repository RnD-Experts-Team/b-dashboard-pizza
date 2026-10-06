"use client";

import { useCallback } from "react";
import { HelpCircle, LifeBuoy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const isRtl = useLocale() === "ar";
  const startReport = useStartReport();

  return (
    // Tablets and up only for now — hidden in the phone drawer.
    <div className="hidden md:block" data-slot="report-problem-sidebar">
      <div className={cn("flex items-center gap-1 px-2 py-2 sm:px-3", collapsed && "justify-center")}>
        <button
          type="button"
          onClick={(e) => void startReport(e.currentTarget, onBeforeStart)}
          // Collapsed there's no room for the "?" — its help goes in the tooltip here.
          title={collapsed ? `${t("label")} — ${t("help")}` : undefined}
          aria-label={t("label")}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "flex-none justify-center px-2",
          )}
        >
          <LifeBuoy className="h-5 w-5 shrink-0 text-muted-foreground" />
          {!collapsed && <span className="truncate">{t("label")}</span>}
        </button>
        {!collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Explains the button — never starts a report itself. */}
              <button
                type="button"
                aria-label={t("helpLabel")}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={isRtl ? "left" : "right"} sideOffset={6} className="max-w-64">
              {t("help")}
            </TooltipContent>
          </Tooltip>
        )}
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
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-9 w-9 md:inline-flex"
          aria-label={t("label")}
          onClick={(e) => void startReport(e.currentTarget)}
        >
          <LifeBuoy className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="max-w-64">
        <p className="font-semibold">{t("label")}</p>
        <p className="opacity-90">{t("help")}</p>
      </TooltipContent>
    </Tooltip>
  );
}
