"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeeDebriefDetailSheet } from "@/components/employee-debriefs/employee-debrief-detail-sheet";
import { DueKeysFeed } from "@/components/due-keys/due-keys-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useEmployeeDebriefs,
  useDeleteEmployeeDebrief,
} from "@/lib/hooks/use-employee-debriefs";
import { useTagsList } from "@/lib/hooks/use-tags";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { cn } from "@/lib/utils";
import { RefreshCw, Trash2, Store, CalendarDays, Tag, CalendarIcon } from "lucide-react";
import type { EmployeeDebriefItem } from "@/types/employee-debrief.types";

/** Convert a YYYY-MM-DD string to a local Date (avoids UTC offset issues). */
function strToDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Convert a local Date to a YYYY-MM-DD string. */
function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDebriefDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DebriefTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">ID</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead className="hidden sm:table-cell">Date Written</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="h-4 w-10 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell>
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </TableCell>
              <TableCell />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function DueKeysPage() {
  const { selectedStore } = useSelectedStoreStore();
  // Use the human-readable store number (e.g. "03795-00001") as the API store_id
  const storeId = selectedStore?.storeId ?? null;

  // ── Date range state ──────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return dateToStr(d);
  });
  const [dateTo, setDateTo] = useState<string>(() => dateToStr(new Date()));
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  // ── Tag filter state ──────────────────────────────────────────────
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const { data: tagsData, isLoading: isTagsLoading } = useTagsList();
  const availableTags = tagsData?.data ?? [];

  // ── Employee Debrief state ─────────────────────────────────────────
  const [selectedDebrief, setSelectedDebrief] = useState<EmployeeDebriefItem | null>(null);
  const [debriefSheetOpen, setDebriefSheetOpen] = useState(false);
  const [deletingDebrief, setDeletingDebrief] = useState<EmployeeDebriefItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const {
    items: debriefItems,
    isLoading: isDebriefLoading,
    isRefreshing: isDebriefRefreshing,
    error: debriefError,
    refetch: refetchDebriefs,
    clearError: clearDebriefError,
  } = useEmployeeDebriefs(storeId);

  const {
    deleteDebrief,
    isDeleting,
    error: deleteError,
    clearError: clearDeleteError,
  } = useDeleteEmployeeDebrief();

  const handleDebriefRowClick = (item: EmployeeDebriefItem) => {
    setSelectedDebrief(item);
    setDebriefSheetOpen(true);
  };

  const handleDebriefDeleteClick = (e: React.MouseEvent, item: EmployeeDebriefItem) => {
    e.stopPropagation();
    setDeletingDebrief(item);
    clearDeleteError();
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteDebrief = async () => {
    if (!deletingDebrief || !storeId) return;
    setDeleteConfirmOpen(false);
    const success = await deleteDebrief(storeId, deletingDebrief.id);
    if (success) {
      toast.success(`Debrief #${deletingDebrief.id} deleted successfully.`);
      if (selectedDebrief?.id === deletingDebrief.id) setDebriefSheetOpen(false);
      refetchDebriefs();
    } else {
      toast.error(deleteError ?? "Failed to delete the debrief.");
    }
    setDeletingDebrief(null);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Due Keys"
        description="Track daily key submissions and employee sign-offs."
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── Sidebar — rendered first so it appears above feed on small screens ── */}
        <div className="order-first w-full shrink-0 lg:order-last lg:w-64" style={{ position: "sticky", top: "1.5rem" }}>
          <div className="flex flex-wrap gap-3 lg:flex-col lg:gap-0 lg:space-y-3">
          {/* Store display — follows global sidebar selection */}
          <div className="min-w-[180px] flex-1 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm lg:min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Store
              </p>
            </div>
            {storeId ? (
              <div className="rounded-md border border-border/40 bg-background/60 px-3 py-2">
                <p className="text-sm font-medium leading-tight">
                  {selectedStore?.name ?? storeId}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{storeId}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No store selected. Use the top-bar store selector.
              </p>
            )}
          </div>

          {/* Date range filter */}
          <div className="min-w-[160px] flex-1 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm lg:min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Date Range
              </p>
            </div>

            {/* From date */}
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">From</p>
            <Popover open={fromOpen} onOpenChange={setFromOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 border-border/50 bg-background/60 px-3 text-left text-xs font-normal"
                >
                  <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {format(strToDate(dateFrom), "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={strToDate(dateFrom)}
                  onSelect={(d) => {
                    if (!d) return;
                    const s = dateToStr(d);
                    setDateFrom(s);
                    if (s > dateTo) setDateTo(s);
                    setFromOpen(false);
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* To date */}
            <p className="mb-1 mt-3 text-[10px] font-medium text-muted-foreground">To</p>
            <Popover open={toOpen} onOpenChange={setToOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 border-border/50 bg-background/60 px-3 text-left text-xs font-normal"
                >
                  <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {format(strToDate(dateTo), "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={strToDate(dateTo)}
                  onSelect={(d) => {
                    if (!d) return;
                    const s = dateToStr(d);
                    setDateTo(s);
                    if (s < dateFrom) setDateFrom(s);
                    setToOpen(false);
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={() => {
                const today = dateToStr(new Date());
                const from = dateToStr(new Date(new Date().setDate(new Date().getDate() - 2)));
                setDateFrom(from);
                setDateTo(today);
              }}
              className="mt-2 text-[11px] text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
            >
              Reset to last 3 days
            </button>
          </div>

          {/* Tag filter */}
          <div className="min-w-[160px] flex-1 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm lg:min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tags
                </p>
              </div>
              {selectedTagIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTagIds([])}
                  className="text-[10px] text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
                >
                  Clear ({selectedTagIds.length})
                </button>
              )}
            </div>

            {isTagsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-4 w-24 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : availableTags.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tags available.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {availableTags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={(checked) => {
                        setSelectedTagIds((prev) =>
                          checked
                            ? [...prev, tag.id]
                            : prev.filter((id) => id !== tag.id)
                        );
                      }}
                    />
                    <label
                      htmlFor={`tag-${tag.id}`}
                      className="cursor-pointer truncate text-xs text-foreground/80 hover:text-foreground"
                    >
                      {tag.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="order-last flex min-w-0 flex-1 flex-col gap-6 lg:order-first">
          {/* Due Keys Feed */}
          <DueKeysFeed
            storeId={storeId}
            dateFrom={dateFrom}
            dateTo={dateTo}
            selectedTags={selectedTagIds.length > 0 ? selectedTagIds : null}
          />

          {/* Employee Debrief section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Employee Debriefs</h2>
                <p className="text-xs text-muted-foreground">
                  Debrief notes for the selected store.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refetchDebriefs}
                disabled={!storeId || isDebriefLoading || isDebriefRefreshing}
              >
                <RefreshCw
                  className={cn("me-2 h-4 w-4", isDebriefRefreshing && "animate-spin")}
                />
                {isDebriefRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            {debriefError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{debriefError}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={refetchDebriefs}>
                    Retry
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearDebriefError}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            <div>
              {isDebriefLoading && !debriefItems.length ? (
                <DebriefTableSkeleton />
              ) : !storeId ? (
                <div className="rounded-md border p-6 text-sm text-muted-foreground">
                  Select a store to load employee debrief notes.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">ID</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead className="hidden sm:table-cell">Date Written</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debriefItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No employee debrief notes found for this store.
                          </TableCell>
                        </TableRow>
                      ) : (
                        debriefItems.map((item) => {
                          const writtenDate = item.date ?? item.createdAt;
                          return (
                            <TableRow
                              key={item.id}
                              className="cursor-pointer"
                              onClick={() => handleDebriefRowClick(item)}
                            >
                              <TableCell className="font-mono text-sm">{item.id}</TableCell>
                              <TableCell className="font-medium">
                                {item.employeeName ? (
                                  item.employeeName
                                ) : item.employeeId != null ? (
                                  <Badge variant="secondary">ID {item.employeeId}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {writtenDate ? (
                                  <span className="text-sm">{formatDebriefDate(writtenDate)}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => handleDebriefDeleteClick(e, item)}
                                  disabled={isDeleting}
                                  aria-label={`Delete debrief #${item.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Debrief detail sheet ───────────────────────────────────── */}
      <EmployeeDebriefDetailSheet
        open={debriefSheetOpen}
        onOpenChange={setDebriefSheetOpen}
        storeId={storeId ?? ""}
        debriefId={selectedDebrief?.id ?? null}
      />

      {/* ── Delete confirmation ────────────────────────────────────── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Debrief</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete debrief{" "}
              <strong>#{deletingDebrief?.id}</strong>
              {deletingDebrief?.employeeName ? ` for ${deletingDebrief.employeeName}` : ""}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteDebrief}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}