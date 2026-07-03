"use client";

import { Fragment, useState } from "react";
import { ArrowRight, ChevronRight, History, Pencil } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { RecountDialog } from "./recount-dialog";
import type { EntryItem, EntryItemEdit } from "@/types/inventory.types";

/** One unit's prev → new value, color-coded by direction of change. */
function DiffField({
  label,
  prev,
  next,
  emphasize,
}: {
  label: string;
  prev: string;
  next: string;
  emphasize?: boolean;
}) {
  const changed = Number(prev) !== Number(next);
  const increased = Number(next) > Number(prev);

  return (
    <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-0.5 flex items-center gap-1 font-mono text-xs", emphasize && "text-sm font-semibold")}>
        {changed ? (
          <>
            <span className="text-muted-foreground line-through decoration-muted-foreground/50">
              {prev}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span
              className={
                increased
                  ? "text-green-600 dark:text-green-400"
                  : "text-orange-600 dark:text-orange-400"
              }
            >
              {next}
            </span>
          </>
        ) : (
          <span>{next}</span>
        )}
      </p>
    </div>
  );
}

/** A single audit-log entry for one recount. */
function EditLogEntry({ edit }: { edit: EntryItemEdit }) {
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
        <DiffField label="Unit 1" prev={edit.prev_count_unit_1} next={edit.new_count_unit_1} />
        <DiffField label="Unit 2" prev={edit.prev_count_unit_2} next={edit.new_count_unit_2} />
        <DiffField label="Unit 3" prev={edit.prev_count_unit_3} next={edit.new_count_unit_3} />
        <DiffField label="Total (U1)" prev={edit.prev_total} next={edit.new_total} emphasize />
      </div>
    </li>
  );
}

/**
 * Renders an entry's item rows with counts and totals.
 *
 * `is_edited`/`edits` only come back for inventory_specialist tokens, so we detect
 * their presence rather than assuming it. When present we show an "edited" badge
 * and an expandable audit-log row; recount is always offered (the backend
 * authorizes store_manager and inventory_specialist alike).
 */
export function EntryDetailItems({ items }: { items: EntryItem[] }) {
  const [recountTarget, setRecountTarget] = useState<EntryItem | null>(null);
  // Pre-expand every item that already has edits so history is visible immediately.
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(items.filter((i) => i.edits && i.edits.length > 0).map((i) => i.id))
  );

  const canEdit = true;
  const colSpan = canEdit ? 6 : 5;

  const toggleExpanded = (itemId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Unit 1</TableHead>
              <TableHead className="text-right">Unit 2</TableHead>
              <TableHead className="text-right">Unit 3</TableHead>
              <TableHead className="text-right">Total (U1)</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
                  No items in this entry.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const hasHistory = Boolean(item.edits && item.edits.length > 0);
                const isOpen = expanded.has(item.id);

                return (
                  <Fragment key={item.id}>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.item.name_en}</span>
                          {item.is_edited && (
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
                      <TableCell className="text-right">{item.count_unit_1}</TableCell>
                      <TableCell className="text-right">{item.count_unit_2}</TableCell>
                      <TableCell className="text-right">{item.count_unit_3}</TableCell>
                      <TableCell className="text-right font-medium">
                        {item.total_in_unit_1}
                      </TableCell>
                      {canEdit && (
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
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={colSpan} className="bg-muted/20 p-0">
                          <ol className="space-y-2 border-t px-4 py-3">
                            {item.edits!.map((edit) => (
                              <EditLogEntry key={edit.id} edit={edit} />
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
