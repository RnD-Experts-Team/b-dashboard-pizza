"use client";

import { useState } from "react";
import { ArrowRight, History, MessageSquare, Paperclip, StickyNote } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttachmentList } from "./attachment-list";
import { RelativeTime } from "./tickets-list";
import { TicketStatusBadge } from "./ticket-status-badge";
import { TicketsEmptyState } from "./tickets-states";
import type {
  TicketAttachment,
  TicketNote,
  TicketResponse,
  TicketStatusChange,
  TicketUserRef,
  ToolboxTicket,
} from "@/types/toolbox-tickets.types";

type ThreadTab = "replies" | "notes" | "files" | "history";

function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Entry({
  id,
  who,
  when,
  highlight,
  children,
}: {
  id?: string;
  who: TicketUserRef | null;
  when: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      id={id}
      className={cn(
        "flex scroll-mt-24 gap-3 rounded-lg p-2 transition-colors",
        highlight && "bg-primary/5 ring-1 ring-primary/30",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
        {initials(who?.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium">{who?.name ?? "—"}</span>
          <RelativeTime value={when} className="text-[11px] text-muted-foreground" />
        </div>
        <div className="mt-1 space-y-2">{children}</div>
      </div>
    </li>
  );
}

function Body({ text }: { text: string }) {
  return <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{text}</p>;
}

interface TicketThreadProps {
  ticket: ToolboxTicket;
  /** `response-{id}` from the URL hash — the notification deep link. */
  highlightResponseId: number | null;
  composer?: React.ReactNode;
}

/**
 * The ticket's conversation. `responses` / `notes` / `attachments` /
 * `status_changes` only come back from `show`; anything else leaves them
 * undefined or null, so every list here defaults to [].
 */
export function TicketThread({ ticket, highlightResponseId, composer }: TicketThreadProps) {
  const t = useTranslations("toolboxTickets.thread");
  const [tab, setTab] = useState<ThreadTab>("replies");

  const responses: TicketResponse[] = ticket.responses ?? [];
  const notes: TicketNote[] = ticket.notes ?? [];
  const history: TicketStatusChange[] = ticket.statusChanges ?? [];
  // Every file in one place: ticket-level + those riding on replies and notes.
  const allFiles: TicketAttachment[] = [
    ...(ticket.attachments ?? []),
    ...responses.flatMap((r) => r.attachments),
    ...notes.flatMap((n) => n.attachments),
  ];

  const count = (n: number) =>
    n > 0 ? (
      <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] leading-none tabular-nums">
        {n}
      </Badge>
    ) : null;

  return (
    <div className="rounded-xl border bg-card shadow-sm" data-slot="ticket-thread">
      <div className="border-b p-4 sm:p-5">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("description")}
        </p>
        <Body text={ticket.description} />
        {(ticket.attachments ?? []).length > 0 && (
          <AttachmentList attachments={ticket.attachments ?? []} className="mt-3" />
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ThreadTab)} className="gap-0">
        <div className="-mx-px overflow-x-auto border-b px-3 pt-3">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            <TabsTrigger value="replies" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              {t("replies")}
              {count(responses.length)}
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5">
              <StickyNote className="h-3.5 w-3.5" />
              {t("notes")}
              {count(notes.length)}
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />
              {t("files")}
              {count(allFiles.length)}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              {t("history")}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Bounded on desktop so the composer stays in reach; natural page scroll on mobile. */}
        <div className="p-3 sm:p-4 lg:max-h-[60vh] lg:overflow-y-auto">
          <TabsContent value="replies" className="mt-0">
            {responses.length === 0 ? (
              <TicketsEmptyState icon={MessageSquare} title={t("noReplies")} body={t("noRepliesBody")} className="py-10" />
            ) : (
              <ol className="space-y-2">
                {responses.map((r) => (
                  <Entry
                    key={r.id}
                    id={`response-${r.id}`}
                    who={r.author}
                    when={r.createdAt}
                    highlight={highlightResponseId === r.id}
                  >
                    <Body text={r.body} />
                    <AttachmentList attachments={r.attachments} dense />
                  </Entry>
                ))}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="notes" className="mt-0">
            {notes.length === 0 ? (
              <TicketsEmptyState icon={StickyNote} title={t("noNotes")} body={t("noNotesBody")} className="py-10" />
            ) : (
              <ol className="space-y-2">
                {notes.map((n) => (
                  <Entry key={n.id} who={n.creator} when={n.createdAt}>
                    <Body text={n.body} />
                    <AttachmentList attachments={n.attachments} dense />
                  </Entry>
                ))}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="files" className="mt-0">
            {allFiles.length === 0 ? (
              <TicketsEmptyState icon={Paperclip} title={t("noFiles")} className="py-10" />
            ) : (
              <AttachmentList attachments={allFiles} />
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <ol className="relative space-y-3 border-s ps-4">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground" />
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {h.from === null ? (
                      <span className="font-medium">{t("opened")}</span>
                    ) : (
                      <>
                        <TicketStatusBadge status={h.from} />
                        <ArrowRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" />
                      </>
                    )}
                    <TicketStatusBadge status={h.to} label={h.toLabel} />
                    {h.isReopen && (
                      <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-700 dark:text-amber-300">
                        {t("reopen")}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {h.creator?.name ?? "—"} · <RelativeTime value={h.createdAt} />
                  </p>
                  {h.reason && (
                    <p className="mt-1 rounded-md bg-muted/50 px-2 py-1 text-xs whitespace-pre-wrap break-words">
                      {h.reason}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </TabsContent>
        </div>
      </Tabs>

      {composer && <div className="border-t p-3 sm:p-4">{composer}</div>}
    </div>
  );
}
