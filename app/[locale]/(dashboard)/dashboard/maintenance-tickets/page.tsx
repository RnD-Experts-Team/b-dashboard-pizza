"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, ClipboardList, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { CatalogManagementDialog, CreateTicketDialog, TicketsErrorCard, TicketsSkeleton } from "@/components/maintenance-tickets";
import { NO_TECHNICIAN, TicketsFilterRow } from "@/components/maintenance-tickets/list/tickets-filter-row";
import { TicketsAttention } from "@/components/maintenance-tickets/list/tickets-attention";
import { TicketsList } from "@/components/maintenance-tickets/list/tickets-list";
import { buildUrlFromFilters, parseFiltersFromUrl } from "@/lib/maintenance-tickets/filters-url";
import { useMaintenanceTickets } from "@/lib/hooks/use-maintenance-tickets";
import { useMaintenanceTicketsStore } from "@/lib/store/maintenance-tickets.store";
import { useAuth } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { Ticket, TicketsFilters } from "@/types/maintenance-tickets.types";

const CATEGORY_PARAM = "category";

/** The URL for these filters plus the technician category (which is not a server filter). */
function listQuery(filters: TicketsFilters, categoryId: number | null): string {
  const qs = new URLSearchParams(buildUrlFromFilters(filters));
  if (categoryId) qs.set(CATEGORY_PARAM, String(categoryId));
  return qs.toString();
}

/**
 * Tickets list (docs/MAINTENANCE-UI.md §1): header + New ticket, one flat
 * filter row, the "needs attention" chips, then the table (cards on a
 * phone). Filters live in the URL so Back and shared links restore them.
 */
function MaintenanceTicketsPageInner() {
  const t = useTranslations("maintenanceSystem");
  const router = useRouter();
  const pathname = usePathname();
  const routeParams = useParams();
  const locale = (routeParams?.locale as string) ?? "en";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { canAccessRoute } = useAuth();
  const { overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();

  const canAccessCatalog = canAccessRoute({ service: "Maintenance", method: "POST", path: "/technicians" });
  const canFilterTechnicians = canAccessRoute({ service: "Maintenance", method: "GET", path: "/technicians" });
  /** Every store's tickets with no stores[] (the MOS head, super admins). */
  const seesEveryStore = canAccessRoute({ service: "Maintenance", method: "GET", path: "/tickets" });

  const activeStores = useMemo(() => overviewStores.filter((s) => s.isActive), [overviewStores]);
  const storeIdOf = (s: (typeof activeStores)[number]) => s.storeId ?? s.id;

  const pageStoreSelection = useMaintenanceTicketsStore((s) => s.storeSelection);
  const setPageStoreSelection = useMaintenanceTicketsStore((s) => s.setStoreSelection);
  const isSingleStore = Array.isArray(pageStoreSelection) && pageStoreSelection.length === 1;
  const hookStoreId = isSingleStore ? pageStoreSelection[0] : undefined;

  const {
    data,
    isLoading,
    isRefreshing,
    error,
    currentPage,
    filters,
    refetch,
    setMode,
    setScopedStoreIds,
    clearError,
    goToPage,
    applyFilters,
    catalogIssues,
    reloadCatalog,
    baseAnalytics,
  } = useMaintenanceTickets({ storeId: hookStoreId });

  /** stores[] for a multi-store pick; null = unrestricted (only for whoever may read every store). */
  const scopeFor = useCallback(
    (selection: string[]) => (seesEveryStore && activeStores.length > 0 && selection.length === activeStores.length ? null : selection),
    [seesEveryStore, activeStores.length],
  );

  const applyStores = useCallback(
    (selection: string[]) => {
      setPageStoreSelection(selection);
      if (selection.length === 1) {
        setScopedStoreIds(null);
        setMode("store");
      } else {
        setScopedStoreIds(scopeFor(selection));
        setMode("global");
      }
    },
    [setPageStoreSelection, setScopedStoreIds, setMode, scopeFor],
  );

  /* ── First store selection: kept from a visit, else the sidebar store ── */
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const kept = useMaintenanceTicketsStore.getState().storeSelection;
    const keptIsValid = kept != null && kept.length > 0 && kept.every((id) => activeStores.some((s) => storeIdOf(s) === id));
    if (keptIsValid) {
      if (kept.length > 1) setScopedStoreIds(scopeFor(kept));
      return;
    }
    const sidebarStoreId = selectedStore?.storeId;
    if (sidebarStoreId != null && activeStores.some((s) => storeIdOf(s) === sidebarStoreId)) return applyStores([sidebarStoreId]);
    if (seesEveryStore && activeStores.length) return applyStores(activeStores.map(storeIdOf));
    if (activeStores[0]) applyStores([storeIdOf(activeStores[0])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── URL ⇄ filters ───────────────────────────────────────────────────── */
  const [categoryId, setCategoryId] = useState<number | null>(() => Number(searchParams.get(CATEGORY_PARAM)) || null);
  const urlSeeded = useRef(false);
  useEffect(() => {
    if (urlSeeded.current) return;
    urlSeeded.current = true;
    const parsed = parseFiltersFromUrl(new URLSearchParams(search));
    if (Object.keys(parsed).length === 0) {
      const kept = useMaintenanceTicketsStore.getState();
      const qs = listQuery({ ...kept.filters, page: kept.currentPage }, categoryId);
      if (qs) router.replace(`${pathname}?${qs}`, { scroll: false });
      return;
    }
    applyFilters(parsed);
    if (parsed.page && parsed.page > 1) goToPage(parsed.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFiltersAndSync = useCallback(
    (next: TicketsFilters, category: number | null = categoryId) => {
      applyFilters(next);
      const qs = listQuery(next, category);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [applyFilters, router, pathname, categoryId],
  );

  function onCategoryChange(next: number | null, technicianIds: number[] | undefined) {
    setCategoryId(next);
    applyFiltersAndSync({ ...filters, technician_ids: technicianIds, page: 1 }, next);
  }

  function onStoresChange(selection: string[]) {
    const next = selection.length ? selection : activeStores.map(storeIdOf);
    applyStores(next);
    setCategoryId(null);
    router.replace(pathname, { scroll: false });
  }

  const [createOpen, setCreateOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  function openTicket(ticket: Ticket) {
    const store = ticket.storeId ? `?store=${encodeURIComponent(ticket.storeId)}` : "";
    router.push(`/${locale}/dashboard/maintenance-tickets/${ticket.id}${store}`);
  }

  function onMutationSuccess() {
    refetch();
    reloadCatalog();
  }

  const hasSelection = pageStoreSelection !== null;
  const activeStoreId = isSingleStore ? pageStoreSelection[0] : undefined;
  const catalogStoreId = activeStoreId || activeStores[0]?.storeId || activeStores[0]?.id || undefined;
  const filtered = Object.entries(filters).some(([k, v]) => k !== "page" && v !== undefined && !(Array.isArray(v) && v.length === 0));
  const onlyNobody = filters.technician_ids?.length === 1 && filters.technician_ids[0] === NO_TECHNICIAN;

  return (
    <div className="space-y-6">
      <PageHeader title={t("pages.tickets")} description={t("tickets.list.description")}>
        <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isLoading || isRefreshing} aria-label={t("common.refresh")}>
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden="true" />
        </Button>
        {canAccessCatalog ? (
          <Button variant="outline" onClick={() => setCatalogOpen(true)}>
            <BookOpen className="me-1.5 h-4 w-4" aria-hidden="true" />
            {t("tickets.list.catalog")}
          </Button>
        ) : null}
        <Button onClick={() => setCreateOpen(true)} disabled={!hasSelection}>
          <Plus className="me-1.5 h-4 w-4" aria-hidden="true" />
          {t("tickets.newTicket")}
        </Button>
      </PageHeader>

      {hasSelection ? (
        <div className="space-y-3">
          <TicketsFilterRow
            filters={filters}
            onFiltersChange={(next) => applyFiltersAndSync(next)}
            stores={activeStores}
            selectedStoreIds={pageStoreSelection ?? []}
            onStoresChange={onStoresChange}
            categoryId={categoryId}
            onCategoryChange={onCategoryChange}
            canFilterTechnicians={canFilterTechnicians}
            isSearching={isLoading || isRefreshing}
            disabled={isLoading && !data}
          />
          <TicketsAttention baseAnalytics={baseAnalytics} filters={filters} onFiltersChange={(next) => applyFiltersAndSync(next)} disabled={isLoading && !data} />
        </div>
      ) : null}

      {!hasSelection || (isLoading && !data) ? <TicketsSkeleton /> : null}

      {hasSelection && error && !data ? <TicketsErrorCard error={error} onRetry={() => refetch()} onClearError={clearError} /> : null}

      {hasSelection && !isLoading && !error && data && data.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {filtered || onlyNobody ? t("tickets.list.emptyFiltered") : t("tickets.list.empty")}
          </p>
          {filtered ? (
            <Button
              variant="outline"
              onClick={() => {
                setCategoryId(null);
                applyFiltersAndSync({ page: 1 }, null);
              }}
            >
              {t("common.clearAll")}
            </Button>
          ) : (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="me-1.5 h-4 w-4" aria-hidden="true" />
              {t("tickets.newTicket")}
            </Button>
          )}
        </div>
      ) : null}

      {hasSelection && data && data.data.length > 0 ? (
        <TicketsList data={data} isRefreshing={isRefreshing} currentPage={currentPage} onPageChange={goToPage} onOpen={openTicket} />
      ) : null}

      <CreateTicketDialog
        open={createOpen}
        storeId={activeStoreId ?? ""}
        catalogIssues={catalogIssues}
        stores={!isSingleStore ? activeStores : undefined}
        onClose={() => setCreateOpen(false)}
        onSuccess={onMutationSuccess}
      />

      <CatalogManagementDialog open={catalogOpen} onClose={() => setCatalogOpen(false)} onReloadCatalog={reloadCatalog} storeId={catalogStoreId} />
    </div>
  );
}

/** useSearchParams needs a Suspense boundary. */
export default function MaintenanceTicketsPage() {
  return (
    <Suspense fallback={<TicketsSkeleton />}>
      <MaintenanceTicketsPageInner />
    </Suspense>
  );
}
