"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RefreshCw, SlidersHorizontal, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection, SectionBreak, SectionGroup } from "@/components/shared/page-section";
import { PayBasketPanel } from "@/components/daily-pay/pay-basket-panel";
import { usePayBasketStore } from "@/lib/store/pay-basket.store";
import { entryFormFromBasket } from "@/lib/daily-pay/from-basket";
import type { EntryFormState } from "@/lib/daily-pay/entry-form-state";
import {
  DailyPaySkeleton,
  DailyPayEmptyState,
  DailyPayErrorCard,
  DailyPayTable,
  DailyPayFiltersBar,
  DailyPayDetailSheet,
  DailyPayEntryDialog,
} from "@/components/daily-pay";
import { useDailyPay } from "@/lib/hooks/use-daily-pay";
import type { DailyPayFilters, DailyPayEntry } from "@/types/daily-pay.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  URL ⇄ filters serialization                                             */
/* ────────────────────────────────────────────────────────────────────────── */

function parseIntList(value: string | null): number[] | undefined {
  if (!value) return undefined;
  const ids = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids.length ? ids : undefined;
}

function parseFiltersFromUrl(params: URLSearchParams): DailyPayFilters {
  const filters: DailyPayFilters = {};

  const techIds = parseIntList(params.get("technician_ids"));
  if (techIds) filters.technician_ids = techIds;

  const storeIds = parseIntList(params.get("store_ids"));
  if (storeIds) filters.store_ids = storeIds;

  const date = params.get("date");
  if (date) filters.date = date;

  const dateFrom = params.get("date_from");
  if (dateFrom) filters.date_from = dateFrom;

  const dateTo = params.get("date_to");
  if (dateTo) filters.date_to = dateTo;

  // filled_by became an ARRAY in the v2 release — same comma-joined URL
  // encoding as technician_ids / store_ids.
  const filledBy = parseIntList(params.get("filled_by"));
  if (filledBy) filters.filled_by = filledBy;

  const createdFrom = params.get("created_from");
  if (createdFrom) filters.created_from = createdFrom;

  const createdTo = params.get("created_to");
  if (createdTo) filters.created_to = createdTo;

  const sort = params.get("sort");
  if (sort === "date" || sort === "created_at") filters.sort = sort;

  const dir = params.get("dir");
  if (dir === "asc" || dir === "desc") filters.dir = dir;

  const perPage = params.get("per_page");
  if (perPage && Number(perPage) > 0) filters.per_page = Number(perPage);

  const page = params.get("page");
  if (page && Number(page) > 0) filters.page = Number(page);

  return filters;
}

function buildUrlFromFilters(filters: DailyPayFilters): string {
  const params = new URLSearchParams();
  if (filters.technician_ids?.length)
    params.set("technician_ids", filters.technician_ids.join(","));
  if (filters.store_ids?.length) params.set("store_ids", filters.store_ids.join(","));
  if (filters.date) params.set("date", filters.date);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.filled_by?.length) params.set("filled_by", filters.filled_by.join(","));
  if (filters.created_from) params.set("created_from", filters.created_from);
  if (filters.created_to) params.set("created_to", filters.created_to);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.dir) params.set("dir", filters.dir);
  if (filters.per_page) params.set("per_page", String(filters.per_page));
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Page                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function DailyPayPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const {
    data,
    isLoading,
    isRefreshing,
    error,
    currentPage,
    filters,
    fetchEntries,
    refetch,
    clearError,
    stores,
    technicians,
    filledByOptions,
  } = useDailyPay();

  // ── URL is the source of truth: fetch whenever the query string changes ──
  useEffect(() => {
    const parsed = parseFiltersFromUrl(new URLSearchParams(search));
    fetchEntries(parsed, parsed.page ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Dialog / sheet state ──────────────────────────────────────────────────
  const [detailId, setDetailId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  /** Set when the dialog was opened from the pay basket, so it opens filled in. */
  const [seededState, setSeededState] = useState<EntryFormState | null>(null);
  const groupForSheet = usePayBasketStore((s) => s.groupForSheet);
  const clearPayBasket = usePayBasketStore((s) => s.clear);
  const [editId, setEditId] = useState<number | null>(null);

  // ── URL writers ─────────────────────────────────────────────────────────
  const pushFilters = useCallback(
    (next: DailyPayFilters) => {
      const qs = buildUrlFromFilters(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  const handleFiltersChange = useCallback(
    (next: DailyPayFilters) => {
      // Any filter change resets to page 1.
      pushFilters({ ...next, page: 1 });
    },
    [pushFilters]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      pushFilters({ ...filters, page });
    },
    [pushFilters, filters]
  );

  // ── Row / action handlers ─────────────────────────────────────────────────
  function handleRowClick(entry: DailyPayEntry) {
    setDetailId(entry.id);
    setSheetOpen(true);
  }

  function handleCreate() {
    setEditId(null);
    // An empty sheet: nothing was collected, so nothing is assumed.
    setSeededState(null);
    setDialogOpen(true);
  }

  /**
   * Opens the dialog filled in from the pay basket.
   *
   * The basket is cleared only once the sheet actually saves -- clearing on
   * open would lose the collected work if the coordinator closed the dialog to
   * go and check something, which is exactly when they would.
   */
  function handleStartSheetFromBasket() {
    setEditId(null);
    setSeededState(entryFormFromBasket(groupForSheet(), stores));
    setDialogOpen(true);
  }

  function handleDialogSuccess() {
    // Saved: the collected work is now on a real sheet, so the staging area has
    // done its job.
    if (seededState) {
      clearPayBasket();
      setSeededState(null);
    }
    refetch();
  }

  function handleEdit(entry: DailyPayEntry) {
    setEditId(entry.id);
    setDialogOpen(true);
  }

  function handleEditFromSheet(entry: DailyPayEntry) {
    setSheetOpen(false);
    setEditId(entry.id);
    setDialogOpen(true);
  }

  function handleSuccess() {
    refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Pay"
        description="End-of-day payment records for technicians."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw className={cn("me-2 h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </PageHeader>

      {/*
        GROUP OF TWO, then the break, then the sheets.

        Note this page has three blocks, not five -- the grouping is 2-then-1
        rather than 2-then-3. The count is not the point; the ASYMMETRY is. An
        even alternation would look the same from everywhere and tell you
        nothing, which is the state we are leaving.
      */}
      <SectionGroup>
        {/* Work marked for payment from the tickets. Renders nothing when
            empty, so on most days this section is simply absent. */}
        <PayBasketPanel onStartSheet={handleStartSheetFromBasket} disabled={isLoading} />

        <PageSection rank="secondary" icon={SlidersHorizontal} title="Narrow it down">
          <DailyPayFiltersBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onCreateClick={handleCreate}
            stores={stores}
            technicians={technicians}
            filledByOptions={filledByOptions}
            disabled={isLoading}
          />
        </PageSection>
      </SectionGroup>

      <SectionBreak />

      {/* Loading skeleton (first load) */}
      {isLoading && !data && <DailyPaySkeleton />}

      {/* Error */}
      {error && !data && (
        <DailyPayErrorCard error={error} onRetry={() => refetch()} onClearError={clearError} />
      )}

      {/* Empty */}
      {!isLoading && !error && data && data.data.length === 0 && <DailyPayEmptyState />}

      {/* The sheets themselves -- the one PRIMARY block on the page. */}
      {data && data.data.length > 0 && (
        <PageSection rank="primary" accent={5} icon={Wallet} title="Pay sheets">
          <DailyPayTable
            data={data}
            isRefreshing={isRefreshing}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onRowClick={handleRowClick}
            onEdit={handleEdit}
          />
        </PageSection>
      )}

      {/* Detail sheet */}
      <DailyPayDetailSheet
        open={sheetOpen}
        entryId={detailId}
        onClose={() => setSheetOpen(false)}
        onEdit={handleEditFromSheet}
        onChanged={refetch}
        technicians={technicians}
        stores={stores}
      />

      {/* Create / edit dialog */}
      <DailyPayEntryDialog
        open={dialogOpen}
        initialState={seededState}
        entryId={editId}
        stores={stores}
        technicians={technicians}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}

export default function DailyPayPage() {
  return (
    <Suspense fallback={<DailyPaySkeleton />}>
      <DailyPayPageInner />
    </Suspense>
  );
}
