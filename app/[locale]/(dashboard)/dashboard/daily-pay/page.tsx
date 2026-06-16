"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
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

  const filledBy = params.get("filled_by");
  if (filledBy && Number.isInteger(Number(filledBy))) filters.filled_by = Number(filledBy);

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
  if (filters.filled_by) params.set("filled_by", String(filters.filled_by));
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
    setDialogOpen(true);
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

      <DailyPayFiltersBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onCreateClick={handleCreate}
        stores={stores}
        technicians={technicians}
        disabled={isLoading}
      />

      {/* Loading skeleton (first load) */}
      {isLoading && !data && <DailyPaySkeleton />}

      {/* Error */}
      {error && !data && (
        <DailyPayErrorCard error={error} onRetry={() => refetch()} onClearError={clearError} />
      )}

      {/* Empty */}
      {!isLoading && !error && data && data.data.length === 0 && <DailyPayEmptyState />}

      {/* Table */}
      {data && data.data.length > 0 && (
        <DailyPayTable
          data={data}
          isRefreshing={isRefreshing}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          onRowClick={handleRowClick}
          onEdit={handleEdit}
        />
      )}

      {/* Detail sheet */}
      <DailyPayDetailSheet
        open={sheetOpen}
        entryId={detailId}
        onClose={() => setSheetOpen(false)}
        onEdit={handleEditFromSheet}
      />

      {/* Create / edit dialog */}
      <DailyPayEntryDialog
        open={dialogOpen}
        entryId={editId}
        stores={stores}
        technicians={technicians}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleSuccess}
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
