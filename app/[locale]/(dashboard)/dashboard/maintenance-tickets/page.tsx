"use client";

import { Suspense, useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import {
  TicketsSkeleton,
  TicketsEmptyState,
  TicketsErrorCard,
  TicketsTable,
  TicketsFiltersBar,
  TicketsAnalyticsPanel,
  CreateTicketDialog,
  CatalogManagementDialog,
} from "@/components/maintenance-tickets";
import { LogVisitDialog } from "@/components/maintenance-tickets/log-visit-dialog";
import { TicketsSearch } from "@/components/maintenance-tickets/tickets-search";
import { TicketsAttentionChips } from "@/components/maintenance-tickets/tickets-attention-chips";
import { IssueBasketBar } from "@/components/maintenance-tickets/issue-basket-bar";
import {
  parseFiltersFromUrl,
  buildUrlFromFilters,
} from "@/lib/maintenance-tickets/filters-url";
import { useMaintenanceTickets } from "@/lib/hooks/use-maintenance-tickets";
import { useAuth } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { Ticket, TicketsFilters } from "@/types/maintenance-tickets.types";

function MaintenanceTicketsPageInner() {
  const t = useTranslations("maintenanceTickets");
  const router = useRouter();
  const pathname = usePathname();
  const routeParams = useParams();
  const locale = (routeParams?.locale as string) ?? "en";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { canAccessRoute } = useAuth();
  const { overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();

  // ─── Auth checks ──────────────────────────────────────────────────────────
  const canAccessCatalog = canAccessRoute({
    service: "Maintenance",
    method: "POST",
    path: "/technicians",
  });

  const canCancelTicket = canAccessRoute({
    service: "Maintenance",
    method: "POST",
    path: "/stores/placeholder/tickets/placeholder/cancel",
  });

  /** Logging a visit posts to the GLOBAL attendance endpoint, not a
   *  ticket-scoped one — hence no storeId on the probe. */
  const canLogVisit = canAccessRoute({
    service: "Maintenance",
    method: "POST",
    path: "/attendance-entries",
  });

  /** True when the current user may fetch all stores via GET /tickets */
  const canAccessAllStores = canAccessRoute({
    service: "Maintenance",
    method: "GET",
    path: "/tickets",
  });

  // ─── Available stores ─────────────────────────────────────────────────────
  const activeStores = useMemo(
    () => overviewStores.filter((s) => s.isActive),
    [overviewStores]
  );

  // ─── Page-level store selection (independent from sidebar) ────────────────
  /**
   * `null`   → still initializing (renders skeleton / nothing)
   * string[] → one or more specific store ids the user has applied.
   *            length === 1 uses the per-store endpoint; length > 1 (or all
   *            of them) uses the global endpoint scoped via stores[] — unless
   *            the user has blanket GET /tickets access, in which case
   *            selecting every store is sent unrestricted.
   */
  const [pageStoreSelection, setPageStoreSelection] = useState<
    string[] | null
  >(null);

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Default to whichever store is selected in the sidebar, not "All Stores" —
    // only fall back to all-stores / first-active-store when the sidebar has no
    // (valid) selection.
    const sidebarStoreId = selectedStore?.storeId;
    const sidebarStoreIsActive =
      sidebarStoreId != null &&
      activeStores.some((s) => (s.storeId ?? s.id) === sidebarStoreId);

    if (sidebarStoreIsActive) {
      setPageStoreSelection([sidebarStoreId as string]);
      setScopedStoreIds(null);
      setMode("store");
    } else if (canAccessAllStores) {
      setPageStoreSelection(activeStores.map((s) => s.storeId ?? s.id));
      setScopedStoreIds(null);
      setMode("global");
    } else {
      const first = activeStores[0];
      if (first) {
        const id = first.storeId ?? first.id;
        setPageStoreSelection([id]);
        setMode("store");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSingleStore =
    Array.isArray(pageStoreSelection) && pageStoreSelection.length === 1;

  /** storeId passed to the hook: only set for a single specific store selection. */
  const hookStoreId = isSingleStore ? pageStoreSelection![0] : undefined;

  // ─── Tickets hook ─────────────────────────────────────────────────────────
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
    catalogTechnicians,
    reloadCatalog,
    analytics,
    analyticsLoading,
    analyticsError,
  } = useMaintenanceTickets({ storeId: hookStoreId });

  // ─── URL <-> filters ──────────────────────────────────────────────────────
  /**
   * The URL is the shareable record of what the list is showing. Daily Pay
   * already works this way; tickets did not, so a filtered view could not be
   * linked, bookmarked, or survive a refresh -- and "look at this one" is the
   * single most common thing the coordinator needs to say to someone else.
   *
   * Read once on mount only. Making this track `search` on every change would
   * fight the store, which is still the owner of the live filter state; the URL
   * here is a mirror that happens to be readable at load time.
   */
  const urlSeeded = useRef(false);
  useEffect(() => {
    if (urlSeeded.current) return;
    urlSeeded.current = true;

    const parsed = parseFiltersFromUrl(new URLSearchParams(search));
    // Nothing in the URL means nothing to restore -- and crucially, no extra
    // request on top of the one the hook already fires on mount.
    if (Object.keys(parsed).length === 0) return;

    applyFilters(parsed);
    if (parsed.page && parsed.page > 1) goToPage(parsed.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Apply a filter change AND record it in the URL. Every filter entry point
   *  on this page goes through here, so there is one writer. */
  const applyFiltersAndSync = useCallback(
    (next: TicketsFilters) => {
      applyFilters(next);
      const qs = buildUrlFromFilters(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [applyFilters, router, pathname]
  );

  const handleSearchChange = useCallback(
    (q: string) => {
      // A new search always starts at page 1; keeping the old page would land
      // on an empty page of a smaller result set.
      applyFiltersAndSync({ ...filters, q: q || undefined, page: 1 });
    },
    [applyFiltersAndSync, filters]
  );

  // ─── Dialog / sheet state ─────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [logVisitOpen, setLogVisitOpen] = useState(false);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  /** Called only when the user clicks Apply in the store filter — not per checkbox click. */
  function handleStoreApply(selection: string[]) {
    if (selection.length === 0) return; // must keep at least one store selected
    setPageStoreSelection(selection);
    const isEveryStoreSelected =
      activeStores.length > 0 && selection.length === activeStores.length;
    if (selection.length === 1) {
      setScopedStoreIds(null);
      setMode("store");
    } else {
      // Unrestricted for users with blanket access when every store is picked; otherwise scope via stores[].
      setScopedStoreIds(canAccessAllStores && isEveryStoreSelected ? null : selection);
      setMode("global");
    }
  }

  /**
   * Opens the ticket on its own page instead of the 75vw sheet.
   *
   * The sheet was the reason everything inside it had to be collapsed -- there
   * was no room -- and it could not be linked, bookmarked, or survive a
   * refresh. Navigating costs a back-press; the rail on the ticket page carries
   * the surrounding tickets so working a queue does not need one.
   */
  function handleTicketClick(ticket: Ticket) {
    router.push(`/${locale}/dashboard/maintenance-tickets/${ticket.id}`);
  }

  function handleMutationSuccess() {
    refetch();
    reloadCatalog();
  }

  // ─── Derived values ───────────────────────────────────────────────────────
  const hasSelection = pageStoreSelection !== null;
  const isStoreMode = isSingleStore;
  /** storeId forwarded to child components that need a specific store context */
  const activeStoreId = isSingleStore ? pageStoreSelection![0] : undefined;

  /**
   * Store sent as X-Store-Id on catalog/issues GET and POST.
   * Priority: page-selected store → last-opened ticket's store → first active store.
   * This ensures the header is ALWAYS populated when any store context is available.
   */
  const catalogStoreId =
    activeStoreId ||
    activeStores[0]?.storeId ||
    activeStores[0]?.id ||
    undefined;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw
            className={cn("me-2 h-4 w-4", isRefreshing && "animate-spin")}
          />
          {t("refresh")}
        </Button>
      </PageHeader>

      {/* Search — the primary way in. Put above the filter panel because it is
          what the coordinator reaches for first: they remember the store, the
          technician, or "the fryer thing", never the ticket id. */}
      {hasSelection && (
        <TicketsSearch
          value={filters.q ?? ""}
          onChange={handleSearchChange}
          isSearching={isLoading || isRefreshing}
        />
      )}

      {/* What needs me — plain counts the backend already computed over this
          same filtered set, each one a toggle. No extra request. */}
      {hasSelection && (
        <TicketsAttentionChips
          analytics={analytics}
          filters={filters}
          onFiltersChange={applyFiltersAndSync}
          isLoading={analyticsLoading}
          disabled={isLoading}
        />
      )}

      {/* The basket follows you here from the ticket pages, so a trip picked up
          across several tickets can be booked or logged in one go. Renders
          nothing when empty. */}
      <IssueBasketBar
        technicians={catalogTechnicians}
        onLogVisit={canLogVisit ? () => setLogVisitOpen(true) : undefined}
        onChanged={handleMutationSuccess}
      />

      {/* Filters bar — always shown once a selection is initialised */}
      {hasSelection && (
        <TicketsFiltersBar
          filters={filters}
          onFiltersChange={applyFiltersAndSync}
          onCreateClick={() => setCreateOpen(true)}
          onCatalogClick={() => setCatalogOpen(true)}
          canAccessCatalog={canAccessCatalog}
          storeId={catalogStoreId}
          disabled={isLoading}
          stores={activeStores}
          selectedStoreIds={pageStoreSelection ?? []}
          onStoreApply={handleStoreApply}
          loadedCreators={(data?.data ?? []).map((ticket) => ticket.creator)}
          canLogVisit={canLogVisit}
          onLogVisitClick={() => setLogVisitOpen(true)}
        />
      )}

      {/* Analytics — reflects whatever filters/store are currently applied */}
      {hasSelection && (
        <TicketsAnalyticsPanel
          analytics={analytics}
          isLoading={analyticsLoading}
          error={analyticsError}
        />
      )}

      {/* Still initialising */}
      {!hasSelection && <TicketsSkeleton />}

      {/* Loading skeleton */}
      {hasSelection && isLoading && !data && <TicketsSkeleton />}

      {/* Error state */}
      {hasSelection && error && !data && (
        <TicketsErrorCard
          error={error}
          onRetry={() => refetch()}
          onClearError={clearError}
        />
      )}

      {/* Empty data */}
      {hasSelection && !isLoading && !error && data && data.data.length === 0 && (
        <TicketsEmptyState type="no-data" />
      )}

      {/* Data table */}
      {hasSelection && data && data.data.length > 0 && (
        <TicketsTable
          data={data}
          isRefreshing={isRefreshing}
          currentPage={currentPage}
          onPageChange={goToPage}
          onTicketClick={handleTicketClick}
          onRowChanged={handleMutationSuccess}
          canCancelTicket={canCancelTicket}
        />
      )}

      {/* Create ticket dialog */}
      <CreateTicketDialog
        open={createOpen}
        storeId={activeStoreId ?? ""}
        catalogIssues={catalogIssues}
        stores={!isStoreMode ? activeStores : undefined}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleMutationSuccess}
      />

      {/* Log a visit — one attendance entry across any number of tickets */}
      <LogVisitDialog
        open={logVisitOpen}
        technicians={catalogTechnicians}
        storeNumber={activeStoreId ?? null}
        onClose={() => setLogVisitOpen(false)}
        onSuccess={refetch}
      />

      {/* Catalog management dialog */}
      <CatalogManagementDialog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onReloadCatalog={reloadCatalog}
        storeId={catalogStoreId}
      />
    </div>
  );
}

/**
 * useSearchParams needs a Suspense boundary to avoid opting the whole route
 * into client-side rendering -- same wrapper Daily Pay uses for the same reason.
 */
export default function MaintenanceTicketsPage() {
  return (
    <Suspense fallback={<TicketsSkeleton />}>
      <MaintenanceTicketsPageInner />
    </Suspense>
  );
}
