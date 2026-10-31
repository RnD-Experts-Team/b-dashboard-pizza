"use client";

import Link from "next/link";
import { ExternalLink, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LocalTimestamp } from "./local-timestamp";
import { topPriority } from "./status-accent";
import { PriorityBadge, StatusBadge } from "./ticket-chips";
import type { Ticket } from "@/types/maintenance-tickets.types";

/**
 * A quick look at one ticket from a dashboard card: title, status, priority,
 * store, when it was opened, its issues, and "Open ticket". Acting on a
 * ticket belongs on the ticket page (`/dashboard/maintenance-tickets/{id}`),
 * so this stays read-only.
 */
export function TicketPeekSheet({
  ticket,
  locale,
  onClose,
}: {
  ticket: Ticket | null;
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations("maintenanceSystem.peek");
  const title = ticket?.issues[0]?.title ?? ticket?.issueTitles[0] ?? "";
  const more = ticket ? Math.max(0, ticket.issueCount - 1) : 0;
  const store = ticket?.storeId ?? ticket?.otherStore ?? "—";
  const priority = ticket ? topPriority(ticket.issues) : null;
  const href = ticket
    ? `/${locale}/dashboard/maintenance-tickets/${ticket.id}${ticket.storeId ? `?store=${encodeURIComponent(ticket.storeId)}` : ""}`
    : "";

  return (
    <Sheet open={ticket !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        {ticket && (
          <>
            <SheetHeader className="border-b">
              <p className="text-xs text-muted-foreground tabular-nums">{t("ticketNumber", { id: ticket.id })}</p>
              <SheetTitle className="font-heading text-lg font-semibold leading-snug">{title}</SheetTitle>
              <SheetDescription>{more ? t("moreIssues", { count: more }) : t("oneIssue")}</SheetDescription>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <StatusBadge status={ticket.status.value} label={ticket.status.label} />
                {priority ? <PriorityBadge priority={priority.value} label={priority.label} /> : null}
                <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs font-medium leading-5">
                  <Store className="h-3 w-3" aria-hidden="true" />
                  {store}
                </span>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 pt-4">
              <p className="text-sm text-muted-foreground">
                {t("opened")} <LocalTimestamp iso={ticket.createdAt} />
              </p>
              {ticket.issues.length > 1 ? (
                <ul className="divide-y rounded-lg border">
                  {ticket.issues.map((issue) => (
                    <li key={issue.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 truncate text-sm" title={issue.title}>
                        {issue.title}
                      </span>
                      {issue.status ? <StatusBadge status={issue.status.value} label={issue.status.label} size="sm" className="shrink-0" /> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <SheetFooter className="border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button asChild className="w-full">
                <Link href={href}>
                  <ExternalLink className="me-1.5 h-4 w-4" aria-hidden="true" />
                  {t("openTicket")}
                </Link>
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
