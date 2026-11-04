"use client";

import { useRef, type CSSProperties } from "react";
import { ChevronUp, MessageSquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WHOSE_TURN, vocabText } from "@/lib/maintenance/vocabulary";
import { actionMeta, splitNextActions, whoseTurn } from "@/lib/maintenance-workflow";
import type { IssueStatus, WorkflowNextAction } from "@/types/maintenance-system";
import { StatusBadge } from "../ticket-chips";
import { useDockInsets, useFabClearance } from "./use-dock-insets";

/** The step's label in the viewer's language; the server's words for ids this app does not know. */
export function useActionLabel() {
  const t = useTranslations("maintenanceSystem");
  return (action: WorkflowNextAction, status: IssueStatus): string => {
    if (action.action === "review" && status === "in_review") return t("tickets.footer.updateReview");
    const meta = actionMeta(action.action);
    return meta.key && t.has(meta.key) ? t(meta.key) : action.label || meta.label;
  };
}

/**
 * The ticket page's action bar (UI doc §2): flush with the bottom of the
 * content area in every layout, above the mobile bottom nav while it shows.
 *
 *   [status · whose turn]            [Add update]  [Primary next step | ˄]
 *
 * The primary button is the workflow's `next[0]`; the other valid steps sit
 * in the menu joined to it. While the Now panel's own buttons are on screen
 * (`hideSteps`) the bar keeps only the context and "Add update", so the page
 * never shows the same step twice. On a phone it is two rows: the primary takes the
 * full width on top, so its whole label shows, and the context line and "Add
 * update" sit under it, where the floating Debrief button rests.
 */
export function TicketFooter({
  next,
  status,
  canAddUpdate,
  disabled,
  hideSteps = false,
  onAction,
  onAddUpdate,
}: {
  next: WorkflowNextAction[];
  /** The Now panel's buttons are visible: leave the steps to it. */
  hideSteps?: boolean;
  status: IssueStatus;
  canAddUpdate: boolean;
  disabled?: boolean;
  onAction: (action: WorkflowNextAction) => void;
  onAddUpdate: () => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const label = useActionLabel();
  const ref = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const { primary, others } = splitNextActions(hideSteps ? [] : next);
  const shown = Boolean(primary) || canAddUpdate;
  const dock = useDockInsets(ref, shown);
  // Each row leaves room for the Debrief button only where the button actually sits on it.
  const primaryRoom = useFabClearance(primaryRef, shown && Boolean(primary), ref);
  const contextRoom = useFabClearance(contextRef, shown, ref);
  if (!shown) return null;

  // With the inspection result in, the next move (ask for approval / schedule) is the office's.
  const turn = status === "inspection" && primary && primary.action !== "inspection_result" ? "office" : whoseTurn(status) ?? "none";
  const primaryDestructive = primary ? Boolean(actionMeta(primary.action).destructive) : false;

  return (
    <div
      ref={ref}
      role="region"
      aria-label={t("tickets.footer.region")}
      data-slot="ticket-action-bar"
      style={{ bottom: dock.bottom, marginBottom: dock.marginBottom }}
      className={cn(
        "sticky z-20 -mx-4 border-t bg-background/95 px-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:-mx-6 md:px-6",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_16px_-10px_rgb(0_0_0/0.25)]",
        "transition-[bottom] duration-300 ease-out motion-reduce:transition-none",
      )}
    >
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-2 sm:items-center">
        {/* What the page is waiting on, so the buttons read as an answer to it */}
        <div
          ref={contextRef}
          className={cn("flex min-w-0 items-center gap-2 sm:flex-1", primary ? "max-sm:pe-(--fab-room)" : "pe-(--fab-room)")}
          style={{ "--fab-room": `${contextRoom}px` } as CSSProperties}
        >
          {/* On a phone with the Debrief button beside it, the row has no room for the status too (the header has it). */}
          <div className={cn("min-w-0 flex-1 items-center gap-2", contextRoom > 0 ? "hidden sm:flex" : "flex")}>
            <StatusBadge status={status} size="sm" className="shrink-0" />
            {turn !== "none" ? (
              <span className="truncate text-xs text-muted-foreground">
                {t("tickets.footer.turn", { who: vocabText(t, WHOSE_TURN[turn]) })}
              </span>
            ) : null}
          </div>

          {canAddUpdate ? (
            <Button
              variant="outline"
              onClick={onAddUpdate}
              disabled={disabled}
              className={cn("h-9 px-3 sm:h-10 sm:px-4", contextRoom > 0 ? "max-sm:flex-1 sm:shrink-0" : "shrink-0")}
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              <span>{t("workflow.addUpdate")}</span>
            </Button>
          ) : null}
        </div>

        {primary ? (
          <div ref={primaryRef} className="flex min-w-0 sm:flex-none" style={primaryRoom ? { paddingInlineEnd: primaryRoom } : undefined}>
            <Button
              onClick={() => onAction(primary)}
              disabled={disabled}
              variant={primaryDestructive ? "destructive" : "default"}
              className={cn("h-10 min-w-0 flex-1 px-4 sm:min-w-40 sm:flex-none", others.length && "rounded-e-none")}
            >
              <span className="truncate">{label(primary, status)}</span>
            </Button>
            {others.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={disabled}
                    variant={primaryDestructive ? "destructive" : "default"}
                    className="h-10 shrink-0 rounded-s-none border-s border-primary-foreground/25 px-2.5"
                    aria-label={t("workflow.moreActions")}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" sideOffset={8} className="min-w-56">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("tickets.footer.otherSteps")}</DropdownMenuLabel>
                  {others.map((a) => (
                    <DropdownMenuItem
                      key={a.action}
                      onSelect={() => onAction(a)}
                      className={cn("py-2", actionMeta(a.action).destructive && "text-destructive focus:text-destructive")}
                    >
                      {label(a, status)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
