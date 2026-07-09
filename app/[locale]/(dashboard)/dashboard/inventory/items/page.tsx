"use client";

import { useEffect, useState } from "react";
/* eslint-disable @next/next/no-img-element -- images come from the same-origin
   /inventory-storage proxy, so next/image remote config isn't needed. */
import { useParams, useRouter } from "next/navigation";
import { ImageOff, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useItems } from "@/lib/hooks/use-inventory-items";
import {
  getInventoryErrorMessage,
  isDisplayableErrorMessage,
} from "@/lib/api/inventory-errors";
import { DeleteConfirmDialog } from "@/components/inventory/delete-confirm-dialog";
import { ItemDetailSheet } from "@/components/inventory/item-detail-sheet";
import type { Item } from "@/types/inventory.types";

/**
 * Items list — thumbnail + names + units + types, with edit/delete row actions.
 * Create/edit happen on dedicated pages (the form is large + multipart).
 */
export default function ItemsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  // Ambient dashboard store — GET /inventory/items[/:id] are store-scoped, so we
  // send the human store_number (not the internal id) as X-Store-Id; the backend
  // resolves it to authorize the store's permission set.
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const storeNumber = selectedStore?.storeId ?? overviewStores?.[0]?.storeId;

  const { items, pagination, isLoading, isDeleting, error, deleteItem, handlePageChange } =
    useItems(undefined, storeNumber);

  // Rule-based UI gating. GET (list) is scoped; POST/PUT/DELETE remain non-scoped.
  const { canAccessRoute } = useAuthStore();
  const canCreateItem = canAccessRoute({ service: "Inventory", method: "POST", path: "/inventory/items" });
  const canEditItem = canAccessRoute({ service: "Inventory", method: "PUT", path: "/inventory/items/*" });
  const canDeleteItem = canAccessRoute({ service: "Inventory", method: "DELETE", path: "/inventory/items/*" });

  const [deleting, setDeleting] = useState<Item | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  useEffect(() => {
    if (isDisplayableErrorMessage(error)) toast.error(error);
  }, [error]);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteItem(deleting.id);
      toast.success("Item deleted.");
      setDeleting(null);
      // Also close the detail sheet if the deleted item was open in it.
      if (selectedItemId === deleting.id) setSelectedItemId(null);
    } catch (err) {
      // Map the thrown error directly — reading `deleteError` from the render
      // closure is stale on the first press (it only updates next render).
      const message = getInventoryErrorMessage(err);
      if (isDisplayableErrorMessage(message)) toast.error(message);
    }
  };

  const columns = [
    {
      key: "image",
      header: "",
      className: "w-14",
      cell: (item: Item) =>
        item.image ? (
          <img
            src={item.image}
            alt={item.name_en}
            className="h-10 w-10 rounded-md border object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-md border text-muted-foreground">
            <ImageOff className="h-4 w-4" />
          </div>
        ),
    },
    {
      key: "name_en",
      header: "Name",
      cell: (item: Item) => (
        <div>
          <p className="font-medium">{item.name_en}</p>
          <p className="text-xs text-muted-foreground">{item.ultimatrix_id}</p>
        </div>
      ),
    },
    {
      key: "units",
      header: "Units",
      cell: (item: Item) =>
        [item.unit_1?.name, item.unit_2?.name, item.unit_3?.name]
          .filter(Boolean)
          .join(" → ") || "—",
    },
    {
      key: "types",
      header: "Types",
      cell: (item: Item) => (
        <div className="flex flex-wrap gap-1">
          {item.types.map((t) => (
            <Badge key={t} variant="secondary" className="capitalize">
              {t}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "all_stores",
      header: "Stores",
      cell: (item: Item) =>
        item.all_stores ? (
          <Badge>All</Badge>
        ) : (
          <Badge variant="outline">{item.stores?.length ?? 0}</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "w-12 text-right",
      cell: (item: Item) =>
        canEditItem || canDeleteItem ? (
          <div data-no-row-click="true" className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEditItem && (
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/${locale}/dashboard/inventory/items/${item.id}/edit`)
                    }
                  >
                    <Pencil className="me-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDeleteItem && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleting(item)}
                  >
                    <Trash2 className="me-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Items" description="Catalog items with units, types and images.">
        {canCreateItem && (
          <Button onClick={() => router.push(`/${locale}/dashboard/inventory/items/create`)}>
            <Plus className="me-2 h-4 w-4" />
            New item
          </Button>
        )}
      </PageHeader>

      <DataTable
        data={items}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No items yet."
        pagination={pagination}
        onPageChange={handlePageChange}
        getRowKey={(i) => i.id}
          onRowClick={(i) => setSelectedItemId(i.id)}
      />

      <DeleteConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete item"
        description={`Delete "${deleting?.name_en}"? This also removes its stored image.`}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
      />

      <ItemDetailSheet
        itemId={selectedItemId}
        storeId={storeNumber}
        open={selectedItemId !== null}
        onOpenChange={(o) => !o && setSelectedItemId(null)}
        canEdit={canEditItem}
        onEdit={(item) =>
          router.push(`/${locale}/dashboard/inventory/items/${item.id}/edit`)
        }
        canDelete={canDeleteItem}
        onDelete={(item) => setDeleting(item)}
      />
    </div>
  );
}
