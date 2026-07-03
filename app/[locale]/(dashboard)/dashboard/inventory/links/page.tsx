"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Copy, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { publicCountUrl } from "@/lib/inventory/public-link-url";
import { DataTable } from "@/components/shared/data-table";
import { InventoryStoreSelect } from "@/components/inventory/inventory-store-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useStoreLinks } from "@/lib/hooks/use-inventory-links";
import { useInventoryStores } from "@/lib/hooks/use-inventory-stores";
import { isDisplayableErrorMessage } from "@/lib/api/inventory-errors";
import { cn } from "@/lib/utils";
import { CreateLinkDialog } from "@/components/inventory/create-link-dialog";
import type { Link as InventoryLink } from "@/types/inventory.types";

/** Status → badge variant mapping. */
function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "submitted") return "secondary";
  return "outline";
}

export default function LinksPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const { stores } = useInventoryStores();
  const storeOptions = stores.map((s) => ({
    storeId: s.storeId ?? s.id,
    name: s.name,
  }));

  const [storeId, setStoreId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Auto-select the first store when the list loads.
  useEffect(() => {
    if (!storeId && stores.length > 0) {
      setStoreId(stores[0].storeId ?? stores[0].id);
    }
  }, [stores, storeId]);

  const { links, pagination, isLoading, error, handlePageChange, refetch } =
    useStoreLinks(storeId || null);

  useEffect(() => {
    if (isDisplayableErrorMessage(error)) toast.error(error);
  }, [error]);

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url);
    toast.success("Link copied.");
  };

  const handleLinksCreated = useCallback(
    (createdStoreId: string) => {
      if (createdStoreId === storeId) {
        refetch();
      } else {
        setStoreId(createdStoreId);
      }
    },
    [storeId, refetch]
  );

  const columns = [
    {
      key: "employee",
      header: "Employee",
      cell: (l: InventoryLink) => l.employee?.name ?? "—",
    },
    { key: "date", header: "Date", cell: (l: InventoryLink) => l.date },
    {
      key: "type",
      header: "Type",
      cell: (l: InventoryLink) => (
        <Badge variant="outline" className="capitalize">
          {l.type}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (l: InventoryLink) => (
        <Badge variant={statusVariant(l.status)} className="capitalize">
          {l.status}
        </Badge>
      ),
    },
    {
      key: "items_count",
      header: "Items",
      cell: (l: InventoryLink) => l.items_count,
    },
    {
      key: "actions",
      header: "",
      className: "w-12 text-right",
      cell: (l: InventoryLink) => (
        <div data-no-row-click="true" className="text-right">
          <Button
            variant="outline"
            size="sm"
            onClick={() => copy(publicCountUrl(locale, l.token))}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Links"
        description="Single-use count links assigned to employees."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <InventoryStoreSelect
            stores={storeOptions}
            value={storeId}
            onChange={setStoreId}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => refetch()}
            disabled={isLoading || !storeId}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          Generate links
        </Button>
      </div>

      {storeId ? (
        <DataTable
          data={links}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No links for this store yet."
          pagination={pagination}
          onPageChange={handlePageChange}
          getRowKey={(l) => l.id}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Choose a store above to view and generate links.
          </p>
        </div>
      )}

      <CreateLinkDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialStoreId={storeId}
        onLinksCreated={handleLinksCreated}
      />
    </div>
  );
}
