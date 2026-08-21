"use client";

import { useEffect, useMemo, useState } from "react";
/* eslint-disable @next/next/no-img-element -- images come from the same-origin
   /inventory-storage proxy, so next/image remote config isn't needed. */
import { useParams, useRouter } from "next/navigation";
import { ImageOff, MoreHorizontal, Pencil, Plus, Power, PowerOff, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useItems } from "@/lib/hooks/use-inventory-items";
import {
  getInventoryErrorMessage,
  isDisplayableErrorMessage,
} from "@/lib/api/inventory-errors";
import { ItemDetailSheet } from "@/components/inventory/item-detail-sheet";
import type { Item, InventoryType } from "@/types/inventory.types";

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

  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | InventoryType>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce the search box so it doesn't refetch on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // With no confirmed backend `search` support, a search needs to look across
  // the whole catalog rather than just the current (small default) page — so
  // request a large batch instead of the normal page size while searching.
  // Falls back to normal paginated browsing the moment the search is cleared.
  const SEARCH_FETCH_SIZE = 1000;

  const itemParams = useMemo(
    () => ({
      ...(activeFilter !== "all" && { active: activeFilter === "active" }),
      ...(typeFilter !== "all" && { type: typeFilter }),
      ...(search && { search, page: 1, perPage: SEARCH_FETCH_SIZE }),
    }),
    [activeFilter, typeFilter, search]
  );

  const { items, pagination, isLoading, isToggling, error, toggleActive, handlePageChange } =
    useItems(itemParams, storeNumber);

  // Client-side fallback filter over that larger batch — the backend's own
  // item-type filter is confirmed (?type=), but there's no confirmed backend
  // support for a `search` param yet, so filtering here guarantees the search
  // box actually works regardless of that.
  const visibleItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i) =>
      [i.name_en, i.name_ar, i.name_es, i.ultimatrix_id].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  }, [items, search]);

  // Rule-based UI gating. GET (list) is scoped; POST/PUT/DELETE remain non-scoped.
  const { canAccessRoute } = useAuthStore();
  const canCreateItem = canAccessRoute({ service: "Inventory", method: "POST", path: "/inventory/items" });
  const canEditItem = canAccessRoute({ service: "Inventory", method: "PUT", path: "/inventory/items/*" });
  const canToggleItem = canAccessRoute({ service: "Inventory", method: "PATCH", path: "/inventory/items/*/active" });

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  useEffect(() => {
    if (isDisplayableErrorMessage(error)) toast.error(error);
  }, [error]);

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
      key: "is_active",
      header: "Status",
      cell: (item: Item) =>
        item.is_active ? (
          <Badge className="bg-green-500 hover:bg-green-500/80">Active</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Inactive
          </Badge>
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
        canEditItem || canToggleItem ? (
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
                {canToggleItem && canEditItem && <DropdownMenuSeparator />}
                {canToggleItem && item.is_active && (
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await toggleActive(item.id, false);
                        toast.success("Item deactivated.");
                      } catch (err) {
                        const message = getInventoryErrorMessage(err);
                        if (isDisplayableErrorMessage(message)) toast.error(message);
                      }
                    }}
                    disabled={isToggling}
                  >
                    <PowerOff className="me-2 h-4 w-4" />
                    Deactivate
                  </DropdownMenuItem>
                )}
                {canToggleItem && !item.is_active && (
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await toggleActive(item.id, true);
                        toast.success("Item activated.");
                      } catch (err) {
                        const message = getInventoryErrorMessage(err);
                        if (isDisplayableErrorMessage(message)) toast.error(message);
                      }
                    }}
                    disabled={isToggling}
                  >
                    <Power className="me-2 h-4 w-4" />
                    Activate
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs sm:w-56">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search items…"
            className="h-9 ps-8"
          />
        </div>

        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="period">Period</SelectItem>
          </SelectContent>
        </Select>

        <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={visibleItems}
        columns={columns}
        isLoading={isLoading}
        emptyMessage={search ? "No items match your search." : "No items yet."}
        pagination={pagination}
        onPageChange={handlePageChange}
        getRowKey={(i) => i.id}
        onRowClick={(i) => setSelectedItemId(i.id)}
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
        canToggle={canToggleItem}
        onToggle={async (item, targetIsActive) => {
          try {
            await toggleActive(item.id, targetIsActive);
            toast.success(targetIsActive ? "Item activated." : "Item deactivated.");
          } catch (err) {
            const message = getInventoryErrorMessage(err);
            if (isDisplayableErrorMessage(message)) toast.error(message);
            throw err;
          }
        }}
      />
    </div>
  );
}
