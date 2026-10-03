"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, EyeOff, RotateCcw } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { PER_PAGE_OPTIONS } from "@/lib/toolbox-tickets/filters-url";
import { TicketStatusBadge } from "./ticket-status-badge";
import type { TicketPage, ToolboxTicket } from "@/types/toolbox-tickets.types";

export function ticketHref(locale: string, ticket: Pick<ToolboxTicket, "id" | "store">) {
  const store = ticket.store?.storeNumber;
  return `/${locale}/dashboard/tickets/${ticket.id}${store ? `?store=${encodeURIComponent(store)}` : ""}`;
}

/** Relative "3 hours ago" with an absolute tooltip. */
export function RelativeTime({ value, className }: { value: string | null | undefined; className?: string }) {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  if (!value) return <span className={className}>—</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span className={className}>—</span>;
  return (
    <time
      dateTime={value}
      title={format.dateTime(date, { dateStyle: "medium", timeStyle: "short" })}
      className={cn("tabular-nums", className)}
    >
      {format.relativeTime(date, now)}
    </time>
  );
}

function RoleChip({ ticket }: { ticket: ToolboxTicket }) {
  const role = ticket.viewer?.role;
  if (!role || role === "none") return null;
  return (
    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
      {ticket.viewer?.roleLabel ?? role}
    </Badge>
  );
}

interface TicketsListProps {
  page: TicketPage<ToolboxTicket>;
  /** Store queue: rows the caller can't open are hidden and counted. */
  hideUnviewable: boolean;
  showStore: boolean;
  refreshing?: boolean;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

export function TicketsList({
  page,
  hideUnviewable,
  showStore,
  refreshing,
  onPageChange,
  onPerPageChange,
}: TicketsListProps) {
  const t = useTranslations("toolboxTickets.list");
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const rows = hideUnviewable ? page.items.filter((r) => r.viewer?.can.view !== false) : page.items;
  const hidden = page.items.length - rows.length;

  return (
    <div className={cn("space-y-3 transition-opacity", refreshing && "opacity-70")} data-slot="tickets-list">
      {hidden > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <EyeOff className="h-3.5 w-3.5 shrink-0" />
          {t("hidden", { count: hidden })}
        </div>
      )}

      {/* Every row on this page is one the caller can't open — say so instead of an empty table. */}
      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-12 text-center">
          <EyeOff className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-sm text-xs text-muted-foreground">{t("allHidden")}</p>
        </div>
      )}

      {/* md+: compact table */}
      <div className={cn("hidden overflow-hidden rounded-xl border bg-card", rows.length > 0 && "md:block")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-start text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">{t("ticket")}</th>
                <th className="px-3 py-2 text-start">{t("status")}</th>
                <th className="px-3 py-2 text-start">{t("section")}</th>
                {showStore && <th className="px-3 py-2 text-start">{t("store")}</th>}
                <th className="px-3 py-2 text-start">{t("reporter")}</th>
                <th className="px-3 py-2 text-end">{t("activity")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ticket) => (
                <tr key={ticket.id} className="group border-t transition-colors hover:bg-muted/40">
                  <td className="max-w-0 px-3 py-2.5">
                    <Link href={ticketHref(locale, ticket)} className="block min-w-0 outline-none">
                      <span className="flex items-center gap-1.5">
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">#{ticket.id}</span>
                        <span className="truncate font-medium group-hover:underline">{ticket.title}</span>
                        {ticket.reopenCount > 0 && (
                          <RotateCcw className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-label={t("reopened")} />
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <RoleChip ticket={ticket} />
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <TicketStatusBadge status={ticket.status} label={ticket.statusLabel} />
                  </td>
                  <td className="max-w-48 px-3 py-2.5">
                    <span className="block truncate text-xs">{ticket.section?.name ?? "—"}</span>
                  </td>
                  {showStore && (
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap tabular-nums">
                      {ticket.store?.storeNumber ?? "—"}
                    </td>
                  )}
                  <td className="max-w-40 px-3 py-2.5">
                    <span className="block truncate text-xs">{ticket.reporter?.name ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-end text-xs text-muted-foreground whitespace-nowrap">
                    <RelativeTime value={ticket.lastActivityAt ?? ticket.createdAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* < md: stacked cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={ticketHref(locale, ticket)}
              className="block rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium leading-snug break-words">
                  <span className="me-1 text-xs text-muted-foreground tabular-nums">#{ticket.id}</span>
                  {ticket.title}
                </p>
                <TicketStatusBadge status={ticket.status} label={ticket.statusLabel} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span className="max-w-full truncate">{ticket.section?.name ?? "—"}</span>
                {showStore && ticket.store && <span className="tabular-nums">· {ticket.store.storeNumber}</span>}
                <span>· {ticket.reporter?.name ?? "—"}</span>
                <span className="ms-auto">
                  <RelativeTime value={ticket.lastActivityAt ?? ticket.createdAt} />
                </span>
              </div>
              {ticket.viewer?.role && ticket.viewer.role !== "none" && (
                <div className="mt-1.5">
                  <RoleChip ticket={ticket} />
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <TicketsPagination page={page} onPageChange={onPageChange} onPerPageChange={onPerPageChange} />
    </div>
  );
}

export function TicketsPagination({
  page,
  onPageChange,
  onPerPageChange,
}: {
  page: TicketPage<unknown>;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
}) {
  const t = useTranslations("toolboxTickets.list");
  return (
    <div className="flex flex-col-reverse items-center justify-between gap-2 sm:flex-row">
      <p className="text-xs text-muted-foreground tabular-nums">
        {t("range", { from: page.from ?? 0, to: page.to ?? 0, total: page.total })}
      </p>
      <div className="flex items-center gap-2">
        {onPerPageChange && (
          <div className="w-28">
            <SearchableSelect<number>
              options={PER_PAGE_OPTIONS.map((n) => ({ value: n, label: t("perPage", { count: n }) }))}
              value={page.perPage}
              onChange={onPerPageChange}
              searchPlaceholder={t("perPageSearch")}
              className="h-8 text-xs"
            />
          </div>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page.currentPage <= 1}
          onClick={() => onPageChange(page.currentPage - 1)}
          aria-label={t("prev")}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <span className="min-w-16 text-center text-xs tabular-nums">
          {t("pageOf", { page: page.currentPage, last: Math.max(1, page.lastPage) })}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page.currentPage >= page.lastPage}
          onClick={() => onPageChange(page.currentPage + 1)}
          aria-label={t("next")}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
