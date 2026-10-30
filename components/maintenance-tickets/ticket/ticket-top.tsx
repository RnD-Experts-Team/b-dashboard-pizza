"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronsUp,
  CircleSlash,
  Gauge,
  MoreHorizontal,
  RefreshCw,
  Shuffle,
  Store,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TicketHeaderV2 } from "@/lib/api/services/maintenance-workflow.service";
import { IMPACTS, ISSUE_STATUSES, PRIORITIES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { STATUS_TONE, stepDots, type StepDotState } from "@/lib/maintenance-workflow";
import type { IssueStatus, Priority, TicketIssueV2 } from "@/types/maintenance-v2";
import { LocalTimestamp } from "../local-timestamp";

const PILL = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

const PRIORITY_ICON: Record<Priority, typeof ArrowUp> = {
  urgent: ChevronsUp,
  high: ArrowUp,
  medium: ArrowRight,
  low: ArrowDown,
};

const PRIORITY_TONE: Record<Priority, string> = {
  urgent: "bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  high: "bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  medium: "bg-muted text-foreground",
  low: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const t = useTranslations("maintenanceV2");
  const entry = vocabEntry(ISSUE_STATUSES, status, label);
  const tone = STATUS_TONE[status as IssueStatus] ?? STATUS_TONE.cancelled;
  return <span className={cn(PILL, tone, className)}>{vocabText(t, entry)}</span>;
}

export function PriorityBadge({ priority, label }: { priority: string; label?: string }) {
  const t = useTranslations("maintenanceV2");
  const key = (priority in PRIORITY_ICON ? priority : "medium") as Priority;
  const Icon = PRIORITY_ICON[key];
  return (
    <span className={cn(PILL, PRIORITY_TONE[key])}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {vocabText(t, vocabEntry(PRIORITIES, priority, label))}
    </span>
  );
}

/** The issue's effective priority: the office's when set, else the store's. */
export function effectivePriority(issue: TicketIssueV2) {
  return issue.assignedPriority ?? issue.priority;
}

/* ── Header ──────────────────────────────────────────────────────────────── */

export interface TicketMenuPermissions {
  canJump: boolean;
  canCancel: boolean;
  canDelete: boolean;
}

export function TicketHeader({
  ticket,
  issue,
  issueCount,
  backHref,
  isRefreshing,
  onRefresh,
  permissions,
  onJump,
  onCancelIssue,
  onCancelTicket,
  onDelete,
}: {
  ticket: TicketHeaderV2;
  issue: TicketIssueV2;
  issueCount: number;
  backHref: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  permissions: TicketMenuPermissions;
  onJump: () => void;
  onCancelIssue: () => void;
  onCancelTicket: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const priority = effectivePriority(issue);
  const store = ticket.storeNumber ?? ticket.otherStore ?? "—";
  const terminal = issue.status.value === "closed" || issue.status.value === "cancelled";
  const hasMenu = permissions.canJump || permissions.canCancel || permissions.canDelete;

  return (
    <header className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ms-2 h-8">
          <Link href={backHref}>
            <ArrowLeft className="me-1.5 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {t("tickets.page.back")}
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} disabled={isRefreshing} aria-label={t("common.refresh")}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden="true" />
          </Button>
          {hasMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" aria-label={t("tickets.page.moreMenu")}>
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {permissions.canJump ? (
                  <DropdownMenuItem onSelect={onJump}>
                    <Shuffle className="me-2 h-4 w-4" aria-hidden="true" />
                    {t("workflow.actions.jump")}
                  </DropdownMenuItem>
                ) : null}
                {permissions.canCancel && !terminal ? (
                  <DropdownMenuItem onSelect={onCancelIssue}>
                    <CircleSlash className="me-2 h-4 w-4" aria-hidden="true" />
                    {issueCount > 1 ? t("tickets.page.cancelIssue") : t("tickets.page.cancelTicket")}
                  </DropdownMenuItem>
                ) : null}
                {permissions.canCancel && issueCount > 1 && ticket.status.value !== "cancelled" ? (
                  <DropdownMenuItem onSelect={onCancelTicket}>
                    <CircleSlash className="me-2 h-4 w-4" aria-hidden="true" />
                    {t("tickets.page.cancelTicket")}
                  </DropdownMenuItem>
                ) : null}
                {permissions.canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="me-2 h-4 w-4" aria-hidden="true" />
                      {t("tickets.page.deleteTicket")}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground tabular-nums">{t("tickets.page.ticketNumber", { id: ticket.id })}</p>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{issue.title}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={issue.status.value} label={issue.status.label} />
          <PriorityBadge priority={priority.value} label={priority.label} />
          <span className={cn(PILL, "border bg-card text-foreground")}>
            <Store className="h-3 w-3" aria-hidden="true" />
            {ticket.storeNumber ? t("tickets.page.storeNumber", { store }) : store}
          </span>
          {issue.impact ? (
            <span className={cn(PILL, "border bg-card text-foreground")}>
              <Gauge className="h-3 w-3" aria-hidden="true" />
              {vocabText(t, vocabEntry(IMPACTS, issue.impact.value, issue.impact.label))}
            </span>
          ) : null}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {t("tickets.page.opened")} <LocalTimestamp iso={ticket.createdAt} showZone={false} />
          </span>
          {ticket.creator ? (
            <>
              <span aria-hidden="true">|</span>
              <span>{t("tickets.page.submittedBy", { name: ticket.creator.name })}</span>
            </>
          ) : null}
        </p>
      </div>
    </header>
  );
}

/* ── Issue switcher ──────────────────────────────────────────────────────── */

export function IssueSwitcher({
  issues,
  selectedId,
  onSelect,
}: {
  issues: TicketIssueV2[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const t = useTranslations("maintenanceV2.tickets.page");
  if (issues.length <= 1) return null;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div role="tablist" aria-label={t("issueSwitcher")} className="inline-flex w-max gap-1 rounded-lg border bg-muted/40 p-1">
        {issues.map((i, index) => {
          const active = i.id === selectedId;
          return (
            <button
              key={i.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(i.id)}
              className={cn(
                "inline-flex max-w-56 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="tabular-nums text-xs text-muted-foreground">{index + 1}.</span>
              <span className="truncate">{i.title}</span>
              <StatusBadge status={i.status.value} label={i.status.label} className="px-1.5 py-0 text-[10px]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Progress strip ──────────────────────────────────────────────────────── */

const DOT_CLASS: Record<StepDotState, string> = {
  done: "border-primary bg-primary",
  current: "border-primary bg-primary ring-4 ring-primary/20",
  skipped: "border-muted-foreground/50 bg-background",
  upcoming: "border-border bg-muted",
};

const LINE_CLASS: Record<StepDotState, string> = {
  done: "bg-primary",
  current: "bg-border",
  skipped: "bg-primary/40",
  upcoming: "bg-border",
};

/** Every status the issue has been in (the presenter sends `to_status` on each change). */
export function visitedStatuses(issue: TicketIssueV2): IssueStatus[] {
  return issue.statusChanges.flatMap((c) => {
    const raw = c as unknown as { toStatus?: string; status?: { value?: string } | null };
    const value = raw.toStatus ?? raw.status?.value;
    return value ? [value as IssueStatus] : [];
  });
}

export function ProgressStrip({ issue }: { issue: TicketIssueV2 }) {
  const t = useTranslations("maintenanceV2");
  const visited = visitedStatuses(issue);
  const dots = stepDots(issue.status.value, [...visited, issue.status.value]);
  const cancelled = issue.status.value === "cancelled";

  return (
    <nav aria-label={t("tickets.page.progress")} className="rounded-lg border bg-card px-3 py-3">
      <ol className="flex items-start">
        {dots.map((dot, index) => {
          const label = cancelled && dot.id === "closed" ? vocabText(t, ISSUE_STATUSES.cancelled) : t(dot.key);
          return (
            <li key={dot.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" aria-current={dot.state === "current" ? "step" : undefined}>
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", index === 0 ? "bg-transparent" : LINE_CLASS[dot.state])} aria-hidden="true" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className={cn("h-3 w-3 shrink-0 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", DOT_CLASS[dot.state])}>
                      <span className="sr-only">{`${label}: ${t(`tickets.page.stepState.${dot.state}`)}`}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{`${label} · ${t(`tickets.page.stepState.${dot.state}`)}`}</TooltipContent>
                </Tooltip>
                <span
                  className={cn("h-0.5 flex-1", index === dots.length - 1 ? "bg-transparent" : LINE_CLASS[dots[index + 1]?.state ?? "upcoming"])}
                  aria-hidden="true"
                />
              </div>
              <span
                className={cn(
                  "hidden truncate px-0.5 text-center text-[11px] md:block",
                  dot.state === "current" ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-xs font-medium md:hidden">
        {t("tickets.page.stepOf", {
          step: dots.findIndex((d) => d.state === "current") + 1,
          total: dots.length,
          label: cancelled ? vocabText(t, ISSUE_STATUSES.cancelled) : t(dots.find((d) => d.state === "current")?.key ?? "workflow.steps.submitted"),
        })}
      </p>
    </nav>
  );
}
