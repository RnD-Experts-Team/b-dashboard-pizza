"use client";

import { ChevronDown, MessageSquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { actionMeta, splitNextActions } from "@/lib/maintenance-workflow";
import type { IssueStatus, WorkflowNextAction } from "@/types/maintenance-v2";

/** The step's label in the viewer's language; the server's words for ids this app does not know. */
export function useActionLabel() {
  const t = useTranslations("maintenanceV2");
  return (action: WorkflowNextAction, status: IssueStatus): string => {
    if (action.action === "review" && status === "in_review") return t("tickets.footer.updateReview");
    const meta = actionMeta(action.action);
    return meta.key && t.has(meta.key) ? t(meta.key) : action.label || meta.label;
  };
}

/**
 * The sticky footer (UI doc §2): "Add update" and the primary next step
 * (`workflow.next[0]`), the other valid steps in the chevron menu beside it.
 */
export function TicketFooter({
  next,
  status,
  canAddUpdate,
  disabled,
  onAction,
  onAddUpdate,
}: {
  next: WorkflowNextAction[];
  status: IssueStatus;
  canAddUpdate: boolean;
  disabled?: boolean;
  onAction: (action: WorkflowNextAction) => void;
  onAddUpdate: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const label = useActionLabel();
  const { primary, others } = splitNextActions(next);
  if (!primary && !canAddUpdate) return null;

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6 md:px-6">
      <div className="flex items-center justify-end gap-2">
        {canAddUpdate ? (
          <Button variant="outline" onClick={onAddUpdate} disabled={disabled} className="me-auto sm:me-0">
            <MessageSquarePlus className="me-1.5 h-4 w-4" aria-hidden="true" />
            {t("workflow.addUpdate")}
          </Button>
        ) : null}
        {primary ? (
          <div className="flex">
            <Button
              onClick={() => onAction(primary)}
              disabled={disabled}
              className={cn(others.length && "rounded-e-none")}
              variant={actionMeta(primary.action).destructive ? "destructive" : "default"}
            >
              {label(primary, status)}
            </Button>
            {others.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={disabled}
                    className="rounded-s-none border-s border-primary-foreground/20 px-2"
                    aria-label={t("workflow.moreActions")}
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top">
                  {others.map((a) => (
                    <DropdownMenuItem
                      key={a.action}
                      onSelect={() => onAction(a)}
                      className={cn(actionMeta(a.action).destructive && "text-destructive focus:text-destructive")}
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
