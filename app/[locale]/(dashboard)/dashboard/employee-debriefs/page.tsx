"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeeDebriefDetailSheet } from "@/components/employee-debriefs/employee-debrief-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { DebriefTypeBadge } from "@/components/employee-debriefs/debrief-type-badge";
import { cn } from "@/lib/utils";
import { RefreshCw, Trash2 } from "lucide-react";
import type { EmployeeDebriefItem } from "@/types/employee-debrief.types";

interface StoreOption {
  id: string;
  name: string;
}

function parseAuthUserStores(): StoreOption[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("auth-user");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      stores?: Array<{
        store?: {
          id?: string | number;
          store_id?: string | number;
          name?: string;
        };
      }>;
    };
    return (parsed.stores ?? [])
      .map((entry) => {
        const store = entry.store;
        const resolvedId = String(store?.store_id ?? store?.id ?? "").trim();
        const resolvedName = store?.name?.trim() || resolvedId;
        return { id: resolvedId, name: resolvedName };
      })
      .filter((s) => s.id.length > 0);
  } catch {
    return [];
  }
}

function formatDate(raw: string | null | undefined): string {
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
            <TableHead className="hidden md:table-cell">Type</TableHead>
            <TableHead className="hidden sm:table-cell">Date Written</TableHead>
            <TableHead className="hidden lg:table-cell">Notes</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="h-4 w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-7 w-7" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function EmployeeDebriefPage() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // Sheet state
  const [selectedItem, setSelectedItem] = useState<EmployeeDebriefItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Delete confirmation state
  const [deletingItem, setDeletingItem] = useState<EmployeeDebriefItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const parsed = parseAuthUserStores();
    setStores(parsed);
    if (parsed.length > 0) setSelectedStoreId(parsed[0].id);
  }, []);

  const { items, isLoading, isRefreshing, error, refetch, clearError } =
    useEmployeeDebriefs(selectedStoreId);

  const {
    deleteDebrief,
    isDeleting,
    error: deleteError,
    clearError: clearDeleteError,
  } = useDeleteEmployeeDebrief();

  const hasValidContext = useMemo(() => !!selectedStoreId, [selectedStoreId]);

  const handleRowClick = (item: EmployeeDebriefItem) => {
    setSelectedItem(item);
    setSheetOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, item: EmployeeDebriefItem) => {
    e.stopPropagation();
    setDeletingItem(item);
    clearDeleteError();
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem || !selectedStoreId) return;
    setConfirmOpen(false);
    const success = await deleteDebrief(selectedStoreId, deletingItem.id);
    if (success) {
      toast.success(`Debrief #${deletingItem.id} deleted successfully.`);
      if (selectedItem?.id === deletingItem.id) setSheetOpen(false);
      refetch();
    } else {
      toast.error(deleteError ?? "Failed to delete the debrief.");
    }
    setDeletingItem(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Debrief Notes"
        description="View and manage employee debrief notes by store."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={!hasValidContext || isLoading || isRefreshing}
        >
          <RefreshCw
            className={cn("me-2 h-4 w-4", isRefreshing && "animate-spin")}
          />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Store</p>
          <Select
            value={selectedStoreId ?? ""}
            onValueChange={(value) => setSelectedStoreId(value || null)}
            disabled={stores.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  stores.length === 0 ? "No stores found" : "Select store"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Fetch error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading && !items.length ? (
        <DebriefTableSkeleton />
      ) : !hasValidContext ? (
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
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden sm:table-cell">Date Written</TableHead>
                <TableHead className="hidden lg:table-cell">Notes</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No employee debrief notes found for this store.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const writtenDate = item.date ?? item.createdAt;
                  const notesPreview = item.notes
                    ? item.notes.length > 80
                      ? item.notes.slice(0, 80) + "…"
                      : item.notes
                    : null;

                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(item)}
                    >
                      <TableCell className="font-mono text-sm">
                        {item.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.employeeName ? (
                          item.employeeName
                        ) : item.employeeId != null ? (
                          <Badge variant="secondary">
                            ID {item.employeeId}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {item.type ? (
                          <DebriefTypeBadge type={item.type} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {writtenDate ? (
                          <span className="text-sm">{formatDate(writtenDate)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="hidden max-w-xs truncate lg:table-cell"
                        title={item.notes ?? undefined}
                      >
                        {notesPreview ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDeleteClick(e, item)}
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

      {/* Detail sheet */}
      <EmployeeDebriefDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        storeId={selectedStoreId ?? ""}
        debriefId={selectedItem?.id ?? null}
      />

      {/* Delete confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Debrief</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete debrief{" "}
              <strong>#{deletingItem?.id}</strong>
              {deletingItem?.employeeName
                ? ` for ${deletingItem.employeeName}`
                : ""}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
