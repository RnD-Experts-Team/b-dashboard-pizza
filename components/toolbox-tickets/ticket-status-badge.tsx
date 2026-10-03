"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { statusVisual } from "@/lib/toolbox-tickets/status";
import { TICKET_STATUSES, type TicketStatus } from "@/types/toolbox-tickets.types";

/** Our own label for a known status; the server's label for anything new. */
export function useStatusLabel() {
  const t = useTranslations("toolboxTickets.status");
  return (status: string, serverLabel?: string | null) =>
    (TICKET_STATUSES as readonly string[]).includes(status)
      ? t(status as TicketStatus)
      : serverLabel || status;
}

export function TicketStatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string | null;
  className?: string;
}) {
  const statusLabel = useStatusLabel();
  const v = statusVisual(status);
  const Icon = v.icon;
  return (
    <Badge
      data-slot="ticket-status-badge"
      variant="outline"
      className={cn("gap-1 whitespace-nowrap font-medium", v.badge, className)}
    >
      <Icon className="h-3 w-3" />
      {statusLabel(status, label)}
    </Badge>
  );
}
