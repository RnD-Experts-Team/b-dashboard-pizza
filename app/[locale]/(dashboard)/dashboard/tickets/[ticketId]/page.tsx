"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  EditTicketDialog,
  ParticipantsPanel,
  RoutingPanel,
  StatusDialog,
  TicketComposer,
  TicketDetailSkeleton,
  TicketDetailsPanel,
  TicketHeader,
  TicketsErrorState,
  TicketThread,
  useActionError,
  type StatusIntent,
} from "@/components/toolbox-tickets";
import { useResolveTicketStore, useToolboxTicket } from "@/lib/hooks/use-toolbox-ticket";
import { useTicketSections } from "@/lib/hooks/use-toolbox-tickets-list";
import { TicketError } from "@/lib/toolbox-tickets/errors";

/* ────────────────────────────────────────────────────────────────────────── */
/*  One ticket. `?store=CODE` is how every ticket endpoint is addressed;      */
/*  notification links (`/toolbox/tickets/{id}`) carry no store, so it's     */
/*  resolved through the inbox and written back into the URL.                */
/*                                                                            */
/*  Every button renders from `viewer.can` / `allowed_transitions` — never   */
/*  computed here — and every action re-fetches, because both can change     */
/*  between requests.                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export default function ToolboxTicketPage() {
  return (
    <Suspense fallback={<TicketDetailSkeleton />}>
      <TicketScreen />
    </Suspense>
  );
}

function TicketScreen() {
  const t = useTranslations("toolboxTickets");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const rawId = params?.ticketId as string | undefined;
  const ticketId = rawId && /^\d{1,12}$/.test(rawId) ? Number(rawId) : null;
  const storeParam = searchParams.get("store");

  const resolved = useResolveTicketStore(ticketId, storeParam);
  const { ticket, loading, refreshing, error, refetch, reload, actions } = useToolboxTicket(resolved.store, ticketId);
  const { sections } = useTicketSections();
  const reportError = useActionError();

  const [intent, setIntent] = useState<StatusIntent | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);

  // Write a resolved store back into the URL (keeps the #response anchor).
  useEffect(() => {
    if (!storeParam && resolved.store) {
      router.replace(`${pathname}?store=${encodeURIComponent(resolved.store)}${window.location.hash}`, { scroll: false });
    }
  }, [storeParam, resolved.store, pathname, router]);

  // `#response-{id}` — the reply a notification was about. Tracked as state
  // because a notification click for the ticket already on screen changes
  // only the hash (and drops `?store=`), not the route.
  const [hash, setHash] = useState("");
  useEffect(() => setHash(window.location.hash), [searchParams]);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const handledHash = useRef<string | null>(null);
  const fetchedForHash = useRef<string | null>(null);
  useEffect(() => {
    if (!ticket?.responses) return;
    const m = /^#response-(\d+)$/.exec(hash);
    if (!m) return;
    const key = `${ticket.id}${hash}`;
    if (handledHash.current === key) return;
    const id = Number(m[1]);
    if (!ticket.responses.some((r) => r.id === id)) {
      // A reply newer than our copy — fetch once, this effect re-runs on arrival.
      if (fetchedForHash.current !== key) {
        fetchedForHash.current = key;
        void refetch();
      }
      return;
    }
    handledHash.current = key;
    setHighlight(id);
    requestAnimationFrame(() =>
      document.getElementById(`response-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }, [hash, ticket?.id, ticket?.responses, refetch]);
  useEffect(() => {
    if (highlight === null) return;
    const timer = window.setTimeout(() => setHighlight(null), 4000);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ms-2">
      <Link href={`/${locale}/dashboard/tickets`}>
        <ArrowLeft className="me-1.5 h-4 w-4 rtl:rotate-180" />
        {t("errors.back")}
      </Link>
    </Button>
  );

  // A malformed id is just a ticket that doesn't exist.
  const pageError =
    ticketId === null
      ? new TicketError({ code: "NOT_FOUND", message: "Ticket not found." })
      : (resolved.error ?? error);

  if (pageError) {
    return (
      <div className="space-y-4">
        {back}
        <TicketsErrorState
          error={pageError}
          onRetry={() => (resolved.error ? resolved.retry() : void reload())}
          showBack
        />
      </div>
    );
  }

  if (resolved.resolving || (loading && !ticket) || !ticket) {
    return (
      <div className="space-y-4">
        {back}
        <TicketDetailSkeleton />
      </div>
    );
  }

  const can = ticket.viewer?.can;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {back}
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={async () => {
            // A manual refresh says why it failed; the background poll stays silent.
            const err = await refetch();
            if (err) reportError(err);
          }}
        >
          <RefreshCw className={cn("me-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
          {t("refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <TicketHeader ticket={ticket} busy={intent !== null || editOpen} onStatus={setIntent} onEdit={() => setEditOpen(true)} />
          <TicketThread
            ticket={ticket}
            highlightResponseId={highlight}
            composer={
              can?.respond ? (
                <TicketComposer
                  onReply={actions.respond}
                  onNote={actions.note}
                  onAttach={actions.attach}
                  onError={reportError}
                />
              ) : (
                <p className="text-center text-xs text-muted-foreground">{t("detail.readOnly")}</p>
              )
            }
          />
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <TicketDetailsPanel ticket={ticket} />
          <ParticipantsPanel ticket={ticket} actions={actions} onError={reportError} />
          <RoutingPanel ticket={ticket} />
        </aside>
      </div>

      <StatusDialog
        intent={intent}
        from={ticket.status}
        onOpenChange={(o) => !o && setIntent(null)}
        onSubmit={(i, reason) => (i.kind === "reopen" ? actions.reopen(reason) : actions.changeStatus(i.to, reason))}
        onError={reportError}
      />
      <EditTicketDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        ticket={ticket}
        canResection={Boolean(can?.edit && can?.changeStatus)}
        sections={sections}
        onSubmit={actions.update}
        onError={reportError}
      />
    </div>
  );
}
