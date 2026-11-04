"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/utils/date-display";
import type { Ticket } from "@/types/maintenance-tickets.types";
import { topPriority } from "./status-accent";
import { PriorityBadge, StatusBadge } from "./ticket-chips";

/**
 * The compact ticket rows the dashboards show (Dashboard V1 "Recent tickets"
 * card and the DSPR table): number, first issue, status and priority badges
 * (the same ones as the tickets list), and the day it was opened. One line
 * per ticket; the priority drops out when the card is too narrow for it
 * (container query), the status never does.
 */
export function TicketMiniList({
  tickets,
  onOpen,
  dimmed = false,
  className,
}: {
  tickets: Ticket[];
  onOpen: (ticket: Ticket) => void;
  /** A refresh is running: rows fade and ignore clicks. */
  dimmed?: boolean;
  className?: string;
}) {
  const t = useTranslations("maintenanceSystem");
  return (
    <ul className={cn("@container divide-y divide-border/40", dimmed && "pointer-events-none opacity-60", className)}>
      {tickets.map((ticket) => {
        const title = ticket.issues[0]?.title ?? ticket.issueTitles[0] ?? `#${ticket.id}`;
        const more = Math.max(0, ticket.issueCount - 1);
        const priority = topPriority(ticket.issues);
        return (
          <li key={ticket.id}>
            <button
              type="button"
              onClick={() => onOpen(ticket)}
              aria-label={t("tickets.list.openTicket", { id: ticket.id })}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-start transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
            >
              <span className="w-9 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">#{ticket.id}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium" title={title}>
                {title}
                {more ? <span className="ms-1 font-normal text-muted-foreground">{t("tickets.moreIssues", { count: more })}</span> : null}
              </span>
              <StatusBadge status={ticket.status.value} label={ticket.status.label} size="xs" className="shrink-0" />
              {priority ? (
                <PriorityBadge priority={priority.value} label={priority.label} size="xs" className="hidden shrink-0 @[26rem]:inline-flex" />
              ) : null}
              <span className="w-11 shrink-0 text-end text-[10px] text-muted-foreground tabular-nums">{formatTimestamp(ticket.createdAt, "MMM d")}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
