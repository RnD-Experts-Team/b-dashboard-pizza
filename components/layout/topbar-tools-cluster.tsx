"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StorePassportButton } from "@/components/store-passport/store-passport-button";
import { isOnBreak, useBreakTimerStore } from "@/lib/store/break-timer.store";
import { cn } from "@/lib/utils";
import { BreakTimerButton } from "./break-timer-button";

/**
 * A collapsible drawer for the topbar's personal tools — the break timer and
 * the store passport — behind a single chevron, so the icon cluster stays
 * short as more tools land there.
 *
 * Collapsed by default; clicking the chevron slides the tools out toward the
 * inline-start side. Open state is plain component state: AppShell keeps the
 * topbar mounted across route changes, so it survives navigation and resets
 * on a hard reload.
 *
 * There is deliberately no collapse-on-outside-click. Both children own
 * overlays that render in portals (the break timer's popover, the passport
 * dialog), so an outside-click handler would fire on clicks *inside* them and
 * snap the drawer shut mid-interaction.
 */
export function TopbarToolsCluster() {
  const t = useTranslations("topbarTools");
  const sessions = useBreakTimerStore((s) => s.sessions);

  const [userOpen, setUserOpen] = useState(false);
  /**
   * The break store is persisted, so its first client read can differ from
   * what the server rendered. Gate the lock on mount for the same reason
   * BreakTimerButton withholds its first paint.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * A running break forces the drawer open and keeps it there. The break
   * button's whole job while a break runs is to be visible — the live m:ss
   * counter, the amber/red tint and the overtime banner are worthless behind
   * a collapsed chevron.
   */
  const locked = mounted && isOnBreak(sessions);
  const open = userOpen || locked;

  /**
   * `overflow-hidden` is what makes the collapse clip, but it also clips the
   * two things the break timer draws outside its own box: the overtime banner
   * (absolutely positioned at `end-full`) and the pulsing overtime dot. So it
   * is only applied while collapsed or while collapsing — once the drawer has
   * finished opening, overflow goes back to visible.
   */
  const [overflowVisible, setOverflowVisible] = useState(false);
  useEffect(() => {
    if (!open) setOverflowVisible(false);
  }, [open]);

  return (
    <div className="flex items-center">
      <div
        id="topbar-tools"
        onTransitionEnd={(e) => {
          // Only this element's own width transition counts. The break
          // timer's live clock runs the same grid-column animation inside,
          // and its transitionend bubbles up here — acting on it would drop
          // the clipping while the drawer is still mid-open, spilling the
          // buttons over the chevron.
          if (
            open &&
            e.target === e.currentTarget &&
            e.propertyName === "grid-template-columns"
          ) {
            setOverflowVisible(true);
          }
        }}
        className={cn(
          // The grid-column collapse, same idiom as the break timer's own
          // live clock: on an auto-width grid `1fr` resolves to the content's
          // max-content width, so the track interpolates between the two real
          // widths — no hardcoded ceiling to animate through.
          "grid transition-[grid-template-columns,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0",
        )}
      >
        <div
          className={overflowVisible ? "overflow-visible" : "overflow-hidden"}
        >
          {/* `inert` while collapsed — opacity-0 alone would leave both
              buttons in the tab order and in the accessibility tree. */}
          <div className="flex items-center gap-1 pe-1" inert={!open}>
            <BreakTimerButton />
            {/*     <StorePassportButton /> */}
          </div>
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={open}
            aria-controls="topbar-tools"
            aria-label={
              locked ? t("lockedOnBreak") : open ? t("collapse") : t("expand")
            }
            // aria-disabled, not `disabled`: a disabled button swallows the
            // pointer events Radix needs, so the tooltip explaining *why* it
            // won't close would never appear.
            aria-disabled={locked}
            className={cn(locked && "cursor-not-allowed opacity-50")}
            onClick={() => {
              if (!locked) setUserOpen((v) => !v);
            }}
          >
            {/* Two nested elements on purpose: the outer one mirrors the
                chevron's resting direction for RTL, the inner one rotates it
                for the open/closed state. Combining both on one element would
                have them fight. */}
            <span className="rtl:-scale-x-100">
              <ChevronLeft
                className={cn(
                  "h-[1.2rem] w-[1.2rem] transition-transform duration-300 motion-reduce:transition-none",
                  open && "rotate-180",
                )}
              />
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {locked ? t("lockedOnBreak") : open ? t("collapse") : t("expand")}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
