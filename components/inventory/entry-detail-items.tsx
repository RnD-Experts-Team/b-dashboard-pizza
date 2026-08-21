"use client";

import { Fragment, useMemo, useState } from "react";
import { ArrowRight, ChevronRight, History, Pencil, Tags } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatUnitQty, formatTotal } from "@/lib/utils/number";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { RecountDialog } from "./recount-dialog";
import type { EntryItem, EntryItemEdit, EntryItemItem, Unit } from "@/types/inventory.types";

/** A category chip filter — "all" | "uncategorized" | a real tag id. Client-side
 *  only (hides/shows rows), unlike the Entries-list tag filter which is a server
 *  request — so "uncategorized" is fine to offer here. */
type CategoryFilter = "all" | "uncategorized" | number;

function itemMatchesCategory(item: EntryItemItem, filter: CategoryFilter): boolean {
  if (filter === "all") return true;
  const tags = item.tags ?? [];
  if (filter === "uncategorized") return tags.length === 0;
  return tags.some((t) => t.id === filter);
}

/** A count paired with its actual unit name — "—" when the item has no such unit. */
function UnitCell({ unit, count }: { unit: Unit | null; count: string }) {
  if (!unit) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-1 tabular-nums">
      {formatUnitQty(count)}
      <span className="text-xs font-normal text-muted-foreground">{unit.name}</span>
    </span>
  );
}

/** One unit's prev → new value, color-coded by direction of change. `unit` null
 *  means the item has no such unit at all — render a dash instead of a diff. */
function DiffField({
  label,
  unit,
  prev,
  next,
  emphasize,
  format = (v) => v,
}: {
  label: string;
  unit?: Unit | null;
  prev: string;
  next: string;
  emphasize?: boolean;
  format?: (v: string) => string;
}) {
  const changed = Number(prev) !== Number(next);
  const increased = Number(next) > Number(prev);
  const unitless = unit === null;

  return (
    <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {unit && <span className="ms-1 font-normal">({unit.name})</span>}
      </p>
      <p className={cn("mt-0.5 flex items-center gap-1 font-mono text-xs", emphasize && "text-sm font-semibold")}>
        {unitless ? (
          <span className="text-muted-foreground">—</span>
        ) : changed ? (
          <>
            <span className="text-muted-foreground line-through decoration-muted-foreground/50">
              {format(prev)}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span
              className={
                increased
                  ? "text-green-600 dark:text-green-400"
                  : "text-orange-600 dark:text-orange-400"
              }
            >
              {format(next)}
            </span>
          </>
        ) : (
          <span>{format(next)}</span>
        )}
      </p>
    </div>
  );
}

/** A single audit-log entry for one recount. */
function EditLogEntry({ edit, item }: { edit: EntryItemEdit; item: EntryItemItem }) {
  return (
    <li className="rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="text-sm">{edit.reason}</p>
        <p className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {edit.edited_by.name} ·{" "}
          {new Date(edit.edited_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <DiffField label="Unit 1" unit={item.unit_1} prev={edit.prev_count_unit_1} next={edit.new_count_unit_1} format={formatUnitQty} />
        <DiffField label="Unit 2" unit={item.unit_2} prev={edit.prev_count_unit_2} next={edit.new_count_unit_2} format={formatUnitQty} />
        <DiffField label="Unit 3" unit={item.unit_3} prev={edit.prev_count_unit_3} next={edit.new_count_unit_3} format={formatUnitQty} />
        <DiffField label="Total (U1)" prev={edit.prev_total} next={edit.new_total} emphasize format={formatTotal} />
      </div>
    </li>
  );
}

/**
 * Renders an entry's item rows with counts and totals.
 *
 * `is_edited`/`edits` are only present when the entry was fetched via the
 * `/history` endpoint (see `useEntryDetail`'s fetch strategy) — a plain-fetched
 * entry simply omits them, which the optional chaining below handles safely.
 * Edit history (badge + expandable audit log) is shown only when the user is
 * authorized for it (`canViewHistory`, i.e. the `/history` fetch succeeded —
 * admin/inventory_specialist). Recount is gated on the entry-items PATCH rule,
 * which store_manager, inventory_specialist and admin all satisfy.
 */
export function EntryDetailItems({
  items,
  canViewHistory,
}: {
  items: EntryItem[];
  canViewHistory: boolean;
}) {
  const [recountTarget, setRecountTarget] = useState<EntryItem | null>(null);
  // Pre-expand every item that already has edits so history is visible immediately.
  const [expanded, setExpanded] = useState<Set<number>>(
    () =>
      new Set(
        canViewHistory
          ? items.filter((i) => i.edits && i.edits.length > 0).map((i) => i.id)
          : []
      )
  );

  // Category filter — hides/shows rows only (never removes them from the map),
  // so Recount/expand stay wired to a filtered-out-then-back-in row exactly as
  // before. Built from tags already present on this entry's own items.
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const categories = useMemo(() => {
    const byId = new Map<number, { id: number; name_en: string }>();
    let hasUncategorized = false;
    for (const item of items) {
      const tags = item.item.tags ?? [];
      if (tags.length === 0) hasUncategorized = true;
      for (const tag of tags) byId.set(tag.id, tag);
    }
    return {
      tags: Array.from(byId.values()).sort((a, b) => a.name_en.localeCompare(b.name_en)),
      hasUncategorized,
    };
  }, [items]);
  const hasVisibleMatch = items.some((i) => itemMatchesCategory(i.item, activeCategory));

  // Recount is a store-scoped-or-global action; pass the effective store so a
  // store_manager (store-scoped perm) passes, while admin/specialist pass via
  // global perms / super-admin bypass.
  const canAccessRoute = useAuthStore((s) => s.canAccessRoute);
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const canRecount = canAccessRoute({
    service: "Inventory",
    method: "PATCH",
    path: "/inventory/entry-items/*",
    storeId: effectiveStoreId,
  });
  const colSpan = canRecount ? 6 : 5;

  const toggleExpanded = (itemId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  return (
    <>
      {(categories.tags.length > 0 || categories.hasUncategorized) && (
        <div className="mb-3 flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Tags className="h-3 w-3" />
            Category
          </label>
          <Select
            value={String(activeCategory)}
            onValueChange={(v) =>
              setActiveCategory(v === "all" || v === "uncategorized" ? v : Number(v))
            }
          >
            <SelectTrigger
              className={cn(
                "h-9 w-48 text-sm",
                activeCategory !== "all" && "border-primary/40 bg-primary/5"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.tags.map((tag) => (
                <SelectItem key={tag.id} value={String(tag.id)}>
                  {tag.name_en}
                </SelectItem>
              ))}
              {categories.hasUncategorized && (
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Unit 1</TableHead>
              <TableHead className="text-right">Unit 2</TableHead>
              <TableHead className="text-right">Unit 3</TableHead>
              <TableHead className="text-right">Total (U1)</TableHead>
              {canRecount && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
                  No items in this entry.
                </TableCell>
              </TableRow>
            ) : !hasVisibleMatch ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
                  No items in this category.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const hasHistory =
                  canViewHistory && Boolean(item.edits && item.edits.length > 0);
                const isOpen = expanded.has(item.id);
                const visible = itemMatchesCategory(item.item, activeCategory);

                return (
                  <Fragment key={item.id}>
                    <TableRow className={cn(!visible && "hidden")}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.item.name_en}</span>
                          {item.is_edited && canViewHistory && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                            >
                              edited
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {item.item.ultimatrix_id}
                        </span>

                        {hasHistory && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="-ms-1 mt-0.5 flex h-6 gap-1 px-1 text-xs text-muted-foreground"
                            onClick={() => toggleExpanded(item.id)}
                            aria-expanded={isOpen}
                          >
                            <ChevronRight
                              className={cn(
                                "h-3 w-3 shrink-0 transition-transform",
                                isOpen && "rotate-90"
                              )}
                            />
                            <History className="h-3 w-3 shrink-0" />
                            {item.edits!.length} edit{item.edits!.length === 1 ? "" : "s"}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <UnitCell unit={item.item.unit_1} count={item.count_unit_1} />
                      </TableCell>
                      <TableCell className="text-right">
                        <UnitCell unit={item.item.unit_2} count={item.count_unit_2} />
                      </TableCell>
                      <TableCell className="text-right">
                        <UnitCell unit={item.item.unit_3} count={item.count_unit_3} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatTotal(item.total_in_unit_1)}
                      </TableCell>
                      {canRecount && (
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRecountTarget(item)}
                          >
                            <Pencil className="me-1.5 h-3.5 w-3.5" />
                            Recount
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>

                    {/* Full-width audit log — kept out of the cramped Item cell. */}
                    {hasHistory && isOpen && (
                      <TableRow className={cn("hover:bg-transparent", !visible && "hidden")}>
                        <TableCell colSpan={colSpan} className="bg-muted/20 p-0">
                          <ol className="space-y-2 border-t px-4 py-3">
                            {item.edits!.map((edit) => (
                              <EditLogEntry key={edit.id} edit={edit} item={item.item} />
                            ))}
                          </ol>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <RecountDialog
        open={recountTarget !== null}
        onOpenChange={(o) => !o && setRecountTarget(null)}
        entryItem={recountTarget}
      />
    </>
  );
}
