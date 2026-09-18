"use client";

import {
  ArrowUpNarrowWide,
  CalendarArrowDown,
  CalendarClock,
  Clock,
  Flag,
  Package,
  PauseCircle,
  Replace,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  UserRoundPlus,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  actionsByGroup,
  availability,
  suggestedAction,
  type IssueAction,
  type IssueActionId,
} from "@/lib/maintenance-tickets/issue-actions";
import type { TicketIssue } from "@/types/maintenance-tickets.types";

/**
 * Everything you can do to an issue, all on screen at once.
 *
 * This replaces a collapsed "Make Action" section that hid a strip of up to
 * fourteen tabs. Getting to a form took four nested opens -- sheet, issue,
 * section, tab -- before the first field appeared.
 *
 * The rules this obeys, all of them from the person who does this job daily:
 * every action is always visible; the ones that cannot apply are greyed WITH
 * the reason, never removed; each carries a plain-language line saying what it
 * actually does; and the likely next step is emphasised without being the only
 * one you can reach.
 */

const ICONS: Record<string, LucideIcon> = {
  ArrowUpNarrowWide,
  CalendarArrowDown,
  CalendarClock,
  Clock,
  Flag,
  Package,
  PauseCircle,
  Replace,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  UserRoundPlus,
  Users,
  Wallet,
  XCircle,
};

interface IssueActionGridProps {
  issue: TicketIssue;
  activeAction: IssueActionId | null;
  onSelect: (action: IssueActionId | null) => void;
  className?: string;
}

export function IssueActionGrid({
  issue,
  activeAction,
  onSelect,
  className,
}: IssueActionGridProps) {
  const suggested = suggestedAction(issue);
  const groups = actionsByGroup();

  return (
    <div className={cn("space-y-4", className)}>
      {groups.map(({ group, label, actions }) => (
        <div key={group} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                issue={issue}
                isActive={activeAction === action.id}
                isSuggested={suggested === action.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionButton({
  action,
  issue,
  isActive,
  isSuggested,
  onSelect,
}: {
  action: IssueAction;
  issue: TicketIssue;
  isActive: boolean;
  isSuggested: boolean;
  onSelect: (action: IssueActionId | null) => void;
}) {
  const Icon = ICONS[action.icon] ?? Flag;
  const { enabled, reason } = availability(action, issue);

  return (
    <button
      type="button"
      // Disabled, never absent. The reason is rendered in the card itself
      // rather than in a tooltip, because a tooltip is something you have to
      // discover and this has to be readable at a glance.
      disabled={!enabled}
      aria-pressed={isActive}
      onClick={() => onSelect(isActive ? null : action.id)}
      className={cn(
        "group flex h-full flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors",
        enabled
          ? "bg-card hover:border-primary/50 hover:bg-accent"
          : "cursor-not-allowed border-dashed bg-muted/30",
        isActive && "border-primary bg-primary/10",
        isSuggested && !isActive && enabled && "border-primary/60 bg-primary/5",
        action.tone === "danger" && enabled && !isActive && "hover:border-destructive/50"
      )}
    >
      <span className="flex w-full items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            enabled ? "text-muted-foreground" : "text-muted-foreground/50",
            isActive && "text-primary",
            action.tone === "danger" && enabled && "text-destructive/70"
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "text-sm font-medium",
            enabled ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {action.label}
        </span>
        {isSuggested && enabled && (
          <span className="ms-auto rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            next
          </span>
        )}
      </span>

      {/* The reason REPLACES the description when blocked -- showing both would
          make the user read two lines to learn they cannot press it. */}
      <span
        className={cn(
          "text-[11px] leading-snug",
          enabled ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"
        )}
      >
        {enabled ? action.description : reason}
      </span>
    </button>
  );
}
