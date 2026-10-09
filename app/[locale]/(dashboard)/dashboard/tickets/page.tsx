"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Inbox, Plus, RefreshCw, Settings2, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import {
  CreateTicketDialog,
  TicketsAdmin,
  TicketsEmptyState,
  TicketsErrorState,
  TicketsFilters,
  TicketsList,
  TicketsListSkeleton,
  ticketHref,
} from "@/components/toolbox-tickets";
import { useActionError } from "@/components/toolbox-tickets";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useTicketSections, useToolboxTicketsList, type TicketListMode } from "@/lib/hooks/use-toolbox-tickets-list";
import { activeFilterCount, filtersFromParams, filtersToParams } from "@/lib/toolbox-tickets/filters-url";
import type { TicketListFilters } from "@/types/toolbox-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Tickets — ToolboxPizza's internal ticketing (inbox, store queue, admin). */
/*                                                                            */
/*  The page adds no gate of its own (the sidebar item is gated on the       */
/*  Toolbox `GET /v1/tickets` rule): the inbox is filtered upstream to what   */
/*  each caller can see, the store queue hides rows the caller can't open,   */
/*  and the admin tab explains its own 403. Tab + filters live in the URL so  */
/*  a filtered view survives a reload and can be linked.                     */
/* ────────────────────────────────────────────────────────────────────────── */

type Tab = "inbox" | "store" | "admin";
const TABS: Tab[] = ["inbox", "store", "admin"];

export default function ToolboxTicketsPage() {
  return (
    <Suspense fallback={<TicketsListSkeleton />}>
      <TicketsScreen />
    </Suspense>
  );
}

function TicketsScreen() {
  const t = useTranslations("toolboxTickets");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const rawTab = searchParams.get("tab") as Tab | null;
  const tab: Tab = rawTab && TABS.includes(rawTab) ? rawTab : "inbox";
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const storeCode = selectedStore?.storeId ?? null;
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const rawUserId = useAuthStore((s) => s.user?.id);
  const currentUserId = rawUserId != null && /^\d+$/.test(String(rawUserId)) ? Number(rawUserId) : null;

  const storeOptions = useMemo(
    () =>
      // Only stores with a real code: the ticket API speaks codes ("03795-00001"),
      // and a numeric id fallback would 404 STORE_NOT_FOUND / match nothing.
      (overviewStores ?? [])
        .filter((s): s is typeof s & { storeId: string } => Boolean(s.storeId) && s.storeId !== s.id)
        .map((s) => ({ value: s.storeId, label: s.name || s.storeId, hint: s.storeId })),
    [overviewStores],
  );

  const { sections, loading: sectionsLoading, error: sectionsError, reload: reloadSections } = useTicketSections();
  const [createOpen, setCreateOpen] = useState(false);

  const replaceQuery = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setTab = (next: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (next === "inbox") q.delete("tab");
    else q.set("tab", next);
    q.delete("page");
    replaceQuery(q);
  };

  const setFilters = (next: TicketListFilters) =>
    replaceQuery(filtersToParams(next, new URLSearchParams(searchParams.toString())));

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="me-1.5 h-4 w-4" />
          {t("newTicket")}
        </Button>
      </PageHeader>

      {sectionsError && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{t("sectionsError", { message: sectionsError.message })}</span>
          <Button variant="outline" size="sm" className="h-7" onClick={() => void reloadSections()}>
            {t("errors.retry")}
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            <TabsTrigger value="inbox" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              {t("tabs.inbox")}
            </TabsTrigger>
            <TabsTrigger value="store" className="gap-1.5">
              <Store className="h-3.5 w-3.5" />
              {t("tabs.store")}
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              {t("tabs.admin")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inbox" className="mt-4">
          {tab === "inbox" && (
            <TicketsQueue
              mode="inbox"
              filters={filters}
              onFiltersChange={setFilters}
              storeCode={null}
              sections={sections}
              storeOptions={storeOptions}
              currentUserId={currentUserId}
              onCreate={() => setCreateOpen(true)}
            />
          )}
        </TabsContent>

        <TabsContent value="store" className="mt-4">
          {tab === "store" &&
            (storeCode ? (
              <TicketsQueue
                mode="store"
                filters={filters}
                onFiltersChange={setFilters}
                storeCode={storeCode}
                storeName={selectedStore?.name ?? storeCode}
                sections={sections}
                storeOptions={storeOptions}
                currentUserId={currentUserId}
                onCreate={() => setCreateOpen(true)}
              />
            ) : (
              <TicketsEmptyState icon={Store} title={t("queue.noStoreTitle")} body={t("queue.noStoreBody")} />
            ))}
        </TabsContent>

        <TabsContent value="admin" className="mt-4">
          {tab === "admin" && <TicketsAdmin onCatalogChanged={() => void reloadSections()} />}
        </TabsContent>
      </Tabs>

      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        sections={sections}
        sectionsLoading={sectionsLoading}
        storeOptions={storeOptions}
        defaultStore={storeCode}
        currentUserId={currentUserId}
        onCreated={(ticket) => router.push(ticketHref(locale, ticket))}
      />
    </div>
  );
}

interface TicketsQueueProps {
  mode: TicketListMode;
  filters: TicketListFilters;
  onFiltersChange: (next: TicketListFilters) => void;
  storeCode: string | null;
  storeName?: string;
  sections: ReturnType<typeof useTicketSections>["sections"];
  storeOptions: { value: string; label: string; hint?: string }[];
  currentUserId: number | null;
  onCreate: () => void;
}

function TicketsQueue({
  mode,
  filters,
  onFiltersChange,
  storeCode,
  storeName,
  sections,
  storeOptions,
  currentUserId,
  onCreate,
}: TicketsQueueProps) {
  const t = useTranslations("toolboxTickets");
  const list = useToolboxTicketsList(mode, filters, storeCode);
  const reportError = useActionError();
  const filtered = activeFilterCount(filters, { includeStores: mode === "inbox" }) > 0;

  // Past the last page (a stale ?page= link, a store switch, tickets moving
  // on between polls) — snap back rather than show a misleading empty state.
  const lastPage = list.page?.lastPage ?? 1;
  const beyondEnd = Boolean(list.page && list.page.items.length === 0 && filters.page > 1);
  useEffect(() => {
    if (beyondEnd) onFiltersChange({ ...filters, page: Math.max(1, Math.min(lastPage, filters.page - 1)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beyondEnd, lastPage]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {mode === "inbox" ? t("queue.inboxHint") : t("queue.storeHint", { store: storeName ?? "" })}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const err = await list.refresh();
            if (err) reportError(err);
          }}
          disabled={list.loading || list.refreshing}
        >
          <RefreshCw className={cn("me-1.5 h-3.5 w-3.5", list.refreshing && "animate-spin")} />
          {t("refresh")}
        </Button>
      </div>

      <TicketsFilters
        filters={filters}
        onChange={onFiltersChange}
        showStores={mode === "inbox"}
        sections={sections}
        storeOptions={storeOptions}
        currentUserId={currentUserId}
      />

      {(list.loading && !list.page) || beyondEnd ? (
        <TicketsListSkeleton />
      ) : list.error ? (
        <TicketsErrorState error={list.error} onRetry={() => void list.reload()} />
      ) : !list.page || list.page.items.length === 0 ? (
        <TicketsEmptyState
          icon={Inbox}
          title={filtered ? t("queue.emptyFilteredTitle") : t("queue.emptyTitle")}
          body={filtered ? t("queue.emptyFilteredBody") : t("queue.emptyBody")}
          action={
            filtered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onFiltersChange({ ...filters, statuses: [], sectionKeys: [], stores: [], reportedBy: null, search: "", page: 1 })
                }
              >
                {t("filters.clearAll")}
              </Button>
            ) : (
              <Button size="sm" onClick={onCreate}>
                <Plus className="me-1.5 h-4 w-4" />
                {t("newTicket")}
              </Button>
            )
          }
        />
      ) : (
        <TicketsList
          page={list.page}
          hideUnviewable={mode === "store"}
          showStore={mode === "inbox"}
          refreshing={list.refreshing || list.loading}
          onPageChange={(page) => onFiltersChange({ ...filters, page })}
          onPerPageChange={(perPage) => onFiltersChange({ ...filters, perPage, page: 1 })}
        />
      )}
    </div>
  );
}
