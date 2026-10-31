"use client";

import Link from "next/link";
import { ExternalLink, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LocalTimestamp } from "./local-timestamp";
import { StatusChip } from "./ticket-chips";
import type { Ticket } from "@/types/maintenance-tickets.types";

/**
 * A quick look at one ticket from a dashboard card: title, status, store,
 * when it was opened, and "Open ticket". Acting on a ticket belongs on the
 * ticket page (`/dashboard/maintenance-tickets/{id}`), so this stays read-only.
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
  const store = ticket?.otherStore ?? ticket?.storeId ?? "—";

  return (
    <Sheet open={ticket !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {ticket && (
          <>
            <SheetHeader>
              <p className="text-xs text-muted-foreground tabular-nums">{t("ticketNumber", { id: ticket.id })}</p>
              <SheetTitle className="font-heading font-semibold">{title}</SheetTitle>
              <SheetDescription>{more ? t("moreIssues", { count: more }) : t("oneIssue")}</SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip value={ticket.status.value} label={ticket.status.label} />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Store className="h-3.5 w-3.5" aria-hidden="true" />
                  {store}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("opened")} <LocalTimestamp iso={ticket.createdAt} />
              </p>
              <Button asChild className="w-full">
                <Link href={`/${locale}/dashboard/maintenance-tickets/${ticket.id}${ticket.storeId ? `?store=${encodeURIComponent(ticket.storeId)}` : ""}`}>
                  <ExternalLink className="me-1.5 h-4 w-4" aria-hidden="true" />
                  {t("openTicket")}
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
