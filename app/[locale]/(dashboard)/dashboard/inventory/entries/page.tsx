"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/shared/data-table";
import { InventoryStoreSelect } from "@/components/inventory/inventory-store-select";
import { EntryDetailSheet } from "@/components/inventory/entry-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useStoreEntries } from "@/lib/hooks/use-inventory-entries";
import { useInventoryStores } from "@/lib/hooks/use-inventory-stores";
import { isDisplayableErrorMessage } from "@/lib/api/inventory-errors";
import type { Entry } from "@/types/inventory.types";

export default function EntriesPage() {
  const { stores } = useInventoryStores();
  const storeOptions = stores.map((s) => ({
    storeId: s.storeId ?? s.id,
    name: s.name,
  }));

  const [storeId, setStoreId] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);

  // Auto-select the first store when the list loads.
  useEffect(() => {
    if (!storeId && stores.length > 0) {
      setStoreId(stores[0].storeId ?? stores[0].id);
    }
  }, [stores, storeId]);

  const { entries, pagination, isLoading, error, handlePageChange } =
    useStoreEntries(storeId || null);

  useEffect(() => {
    if (isDisplayableErrorMessage(error)) toast.error(error);
  }, [error]);

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
      </div>

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
