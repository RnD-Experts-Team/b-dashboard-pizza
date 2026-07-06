"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/shared/data-table";
import { InventoryStoreSelect } from "@/components/inventory/inventory-store-select";
import { EntryFiltersBar, countEntryFilters } from "@/components/inventory/entry-filters-bar";
import { EntryDetailSheet } from "@/components/inventory/entry-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useStoreEntries } from "@/lib/hooks/use-inventory-entries";
import { useInventoryStores } from "@/lib/hooks/use-inventory-stores";
import { isDisplayableErrorMessage } from "@/lib/api/inventory-errors";
import { cn } from "@/lib/utils";
import type { Entry, EntryListParams } from "@/types/inventory.types";

export default function EntriesPage() {
  const { stores } = useInventoryStores();
  const storeOptions = stores.map((s) => ({
    storeId: s.storeId ?? s.id,
    name: s.name,
  }));

  const [storeId, setStoreId] = useState("");
  const [filters, setFilters] = useState<EntryListParams>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);

  // Auto-select the first store when the list loads.
  useEffect(() => {
    if (!storeId && stores.length > 0) {
      setStoreId(stores[0].storeId ?? stores[0].id);
    }
  }, [stores, storeId]);

  const { entries, pagination, isLoading, error, handlePageChange } =
    useStoreEntries(storeId || null, filters);

  useEffect(() => {
    if (isDisplayableErrorMessage(error)) toast.error(error);
  }, [error]);

  const activeCount = countEntryFilters(filters);

  const columns = [
    { key: "reference", header: "Reference", cell: (e: Entry) => e.reference },
    {
      key: "submitted_by",
      header: "Submitted by",
      cell: (e: Entry) => e.submitted_by,
    },
    { key: "date", header: "Date", cell: (e: Entry) => e.date },
    {
      key: "type",
      header: "Type",
      cell: (e: Entry) => (
        <Badge variant="outline" className="capitalize">
          {e.type}
        </Badge>
      ),
    },
    { key: "items_count", header: "Items", cell: (e: Entry) => e.items_count },
    {
      key: "edited_items_count",
      header: "Edited",
      cell: (e: Entry) =>
        e.edited_items_count > 0 ? (
          <Badge variant="secondary">{e.edited_items_count}</Badge>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entries"
        description="Submitted inventory counts per store."
      />

      <div className="flex flex-wrap items-center gap-2">
        <InventoryStoreSelect
          stores={storeOptions}
          value={storeId}
          onChange={setStoreId}
        />

        {storeId && (
          <>
            <Button
              variant={filtersOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              disabled={isLoading}
              className={cn(
                "h-9 gap-1.5",
                activeCount > 0 && !filtersOpen && "border-primary/40 bg-primary/5 text-primary"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeCount > 0 ? (
                <Badge variant="default" className="h-4 min-w-4 px-1 text-[10px] leading-none">
                  {activeCount}
                </Badge>
              ) : (
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    filtersOpen && "rotate-180"
                  )}
                />
              )}
            </Button>

            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({})}
                disabled={isLoading}
                className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                <span className="text-xs">Clear</span>
              </Button>
            )}
          </>
        )}
      </div>

      {storeId && (
        <EntryFiltersBar
          open={filtersOpen}
          filters={filters}
          onFiltersChange={setFilters}
          disabled={isLoading}
        />
      )}

      {storeId ? (
        <DataTable
          data={entries}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No entries for this store yet."
          pagination={pagination}
          onPageChange={handlePageChange}
          getRowKey={(e) => e.id}
          onRowClick={(e) => setSelectedEntryId(e.id)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Choose a store above to view submitted entries.
          </p>
        </div>
      )}

      <EntryDetailSheet
        entryId={selectedEntryId}
        open={selectedEntryId !== null}
        onOpenChange={(o) => !o && setSelectedEntryId(null)}
      />
    </div>
  );
}
