"use client";

import { Pencil, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isReopenEdge, statusVisual } from "@/lib/toolbox-tickets/status";
import { RelativeTime } from "./tickets-list";
import { TicketStatusBadge, useStatusLabel } from "./ticket-status-badge";
import type { StatusIntent } from "./status-dialog";
import type { ToolboxTicket } from "@/types/toolbox-tickets.types";

interface TicketHeaderProps {
  ticket: ToolboxTicket;
  busy: boolean;
  onStatus: (intent: StatusIntent) => void;
  onEdit: () => void;
}

/**
 * Title, status and the action row. Status buttons are EXACTLY
 * `allowed_transitions` (the server hands back what it would honour), shown
 * only when `viewer.can.change_status`. The terminal → pending edge is the
 * Reopen button, which goes through `/reopen` — it means something different
 * to everyone watching, and it notifies differently.
 */
export function TicketHeader({ ticket, busy, onStatus, onEdit }: TicketHeaderProps) {
  const t = useTranslations("toolboxTickets.detail");
  const statusLabel = useStatusLabel();
  const can = ticket.viewer?.can;

  const moves = can?.changeStatus
    ? ticket.allowedTransitions.filter((to) => !isReopenEdge(ticket.status, to))
    : [];
  const canReopen =
    Boolean(can?.changeStatus) && ticket.isTerminal && ticket.allowedTransitions.includes("pending");

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5" data-slot="ticket-header">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">#{ticket.id}</span>
        <TicketStatusBadge status={ticket.status} label={ticket.statusLabel} />
        {ticket.reopenCount > 0 && (
          <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-700 dark:text-amber-300">
            <RotateCcw className="h-3 w-3" />
            {t("reopenCount", { count: ticket.reopenCount })}
          </Badge>
        )}
        {ticket.viewer && ticket.viewer.role !== "none" && (
          <Badge variant="secondary" className="text-[10px]">
            {t("yourRole", { role: ticket.viewer.roleLabel ?? ticket.viewer.role })}
          </Badge>
        )}
      </div>

      <h2 className="mt-2 font-heading text-xl font-semibold leading-snug break-words sm:text-2xl">
        {ticket.title}
      </h2>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{ticket.section?.name ?? "—"}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{ticket.store?.name ?? ticket.store?.storeNumber ?? "—"}</span>
        <span aria-hidden>·</span>
        <span>{t("reportedBy", { name: ticket.reporter?.name ?? "—" })}</span>
        <span aria-hidden>·</span>
        <RelativeTime value={ticket.createdAt} />
      </div>

      {(moves.length > 0 || canReopen || can?.edit) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
          {moves.map((to) => {
            const Icon = statusVisual(to).icon;
            return (
              <Button
                key={to}
                size="sm"
                variant={to === "fixed" ? "default" : "outline"}
                disabled={busy}
                onClick={() => onStatus({ kind: "status", to })}
                className="gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {t("moveTo", { status: statusLabel(to) })}
              </Button>
            );
          })}
          {canReopen && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus({ kind: "reopen" })} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              {t("reopen")}
            </Button>
          )}
          {can?.edit && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onEdit} className={cn("gap-1.5", "sm:ms-auto")}>
              <Pencil className="h-3.5 w-3.5" />
              {t("edit")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
