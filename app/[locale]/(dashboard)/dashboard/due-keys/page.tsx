"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { DueKeyValueSheet } from "@/components/due-keys/due-key-value-sheet";
import { FillAllKeysSheet } from "@/components/due-keys/fill-all-keys-sheet";
import { EmployeeDebriefDetailSheet } from "@/components/employee-debriefs/employee-debrief-detail-sheet";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDueKeys, useSetDueKeyValue, useSetDueKeysBulk } from "@/lib/hooks/use-due-keys";
import {
  useEmployeeDebriefs,
  useDeleteEmployeeDebrief,
} from "@/lib/hooks/use-employee-debriefs";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { cn } from "@/lib/utils";
import { RefreshCw, Trash2 } from "lucide-react";
import type { DueKeyItem, DueKeyValuePayload } from "@/types/due-key.types";
import type { EmployeeDebriefItem } from "@/types/employee-debrief.types";

interface AuthUserStoreOption {
  id: string;
  name: string;
}

function formatTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseAuthUserStores(): AuthUserStoreOption[] {
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
      .filter((store) => store.id.length > 0);
  } catch {
    return [];
  }
}

function renderValuePreview(item: DueKeyItem): string {
  if (item.value == null) return "—";
  // Prefer the typed value fields returned by the API (value_text, value_number, value_boolean, value_json)
  const v: any = item.value as any;

  if (v?.value_text != null) return String(v.value_text);
  if (v?.value_number != null) return String(v.value_number);
  if (v?.value_boolean != null) return String(v.value_boolean);
  if (v?.value_json != null) {
    try {
      return JSON.stringify(v.value_json);
    } catch {
      return String(v.value_json);
    }
  }

  if (typeof item.value === "object") {
    try {
      return JSON.stringify(item.value);
    } catch {
      return "[Object]";
    }
  }

  return String(item.value);
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
            <TableHead className="hidden lg:table-cell">Notes</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
              <TableCell><Skeleton className="h-7 w-7" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DueKeysTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Key ID</TableHead>
            <TableHead>Label</TableHead>
            <TableHead className="hidden sm:table-cell">Data Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-4 w-10" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="h-4 w-44" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function DueKeysPage() {
  const { canAccessRoute, overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();
  const [stores, setStores] = useState<AuthUserStoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatTodayDate());

  // ── Due Keys sheet state ───────────────────────────────────────────
  const [selectedItem, setSelectedItem] = useState<DueKeyItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Employee Debrief state ─────────────────────────────────────────
  const [selectedDebrief, setSelectedDebrief] = useState<EmployeeDebriefItem | null>(null);
  const [debriefSheetOpen, setDebriefSheetOpen] = useState(false);
  const [deletingDebrief, setDeletingDebrief] = useState<EmployeeDebriefItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    const parsedStores = parseAuthUserStores();
    setStores(parsedStores);

    if (parsedStores.length > 0) {
      setSelectedStoreId(parsedStores[0].id);
    }
  }, []);

  const { data, isLoading, isRefreshing, error, refetch, clearError } = useDueKeys(
    selectedStoreId,
    selectedDate
  );

  const {
    setDueKeyValue,
    isSubmitting,
    error: submitError,
    clearError: clearSubmitError,
  } = useSetDueKeyValue();

  const {
    setDueKeysBulk,
    isSubmitting: isSubmittingBulk,
    error: submitErrorBulk,
    clearError: clearBulkError,
  } = useSetDueKeysBulk();

  const {
    items: debriefItems,
    isLoading: isDebriefLoading,
    isRefreshing: isDebriefRefreshing,
    error: debriefError,
    refetch: refetchDebriefs,
    clearError: clearDebriefError,
  } = useEmployeeDebriefs(selectedStoreId);

  const {
    deleteDebrief,
    isDeleting,
    error: deleteError,
    clearError: clearDeleteError,
  } = useDeleteEmployeeDebrief();

  const [bulkSheetOpen, setBulkSheetOpen] = useState(false);

  const activeItems = data?.items ?? [];

  // Keep store selection behavior aligned with sidebar/keys authorization checks.
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;

  const dueKeysWriteRequirements = [
    {
      service: "Data",
      method: "POST",
      path: "/engine/stores/",
      storeId: effectiveStoreId,
    },
  ];
  const canWriteDueKeys = dueKeysWriteRequirements.some((requirement) =>
    canAccessRoute(requirement)
  );

  const hasValidContext = useMemo(
    () => !!selectedStoreId && !!selectedDate,
    [selectedStoreId, selectedDate]
  );

  const handleRowClick = (item: DueKeyItem) => {
    if (!canWriteDueKeys) return;
    setSelectedItem(item);
    clearSubmitError();
    setSheetOpen(true);
  };

  const handleSubmitValue = async (
    payload: DueKeyValuePayload,
    mode: "created" | "updated" | "deactivated"
  ) => {
    if (!selectedStoreId || !canWriteDueKeys) return;
    const success = await setDueKeyValue(selectedStoreId, selectedDate, payload);

    if (!success) {
      if (submitError) toast.error(submitError);
      return;
    }

    if (mode === "created") {
      toast.success("Key value created successfully.");
    } else if (mode === "deactivated") {
      toast.success("Key value deactivated successfully.");
    } else {
      toast.success("Key value updated successfully.");
    }

    setSheetOpen(false);
    refetch();
  };

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
    if (!deletingDebrief || !selectedStoreId) return;
    setDeleteConfirmOpen(false);
    const success = await deleteDebrief(selectedStoreId, deletingDebrief.id);
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
    <div className="space-y-6">
      <PageHeader
        title="Due Keys"
        description="View due keys by store and date, then update key values directly."
      >
          <div className="flex gap-2">
            {canWriteDueKeys && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkSheetOpen(true)}
                disabled={!hasValidContext || isLoading || isRefreshing || activeItems.length === 0}
              >
                Fill All Keys
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={!hasValidContext || isLoading || isRefreshing}
            >
              <RefreshCw className={cn("me-2 h-4 w-4", isRefreshing && "animate-spin")} />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Store</p>
          <Select
            value={selectedStoreId ?? ""}
            onValueChange={(value) => setSelectedStoreId(value || null)}
            disabled={stores.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={stores.length === 0 ? "No stores found" : "Select store"} />
            </SelectTrigger>
            <SelectContent
                position="popper"
                style={{ maxHeight: "160px", overflowY: "auto" }}
                className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            >
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Date</p>
          <Input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </div>
      </div>

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

      {isLoading && !data ? (
        <DueKeysTableSkeleton />
      ) : !hasValidContext ? (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          Select a store and date to load due keys.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Key ID</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="hidden sm:table-cell">Data Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No due keys found for this store and date.
                  </TableCell>
                </TableRow>
              ) : (
                activeItems.map((item) => (
                  <TableRow
                    key={item.keyId}
                    className={cn(canWriteDueKeys && "cursor-pointer")}
                    onClick={() => {
                      if (canWriteDueKeys) handleRowClick(item);
                    }}
                  >
                    <TableCell>{item.keyId}</TableCell>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="hidden sm:table-cell">{item.dataType}</TableCell>
                    <TableCell>
                      <Badge variant={item.filled ? "default" : "secondary"}>
                        {item.filled ? "Filled" : "Not Filled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-70 truncate lg:table-cell" title={renderValuePreview(item)}>
                      {renderValuePreview(item)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {canWriteDueKeys && (
        <DueKeyValueSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          item={selectedItem}
          storeId={selectedStoreId ?? ""}
          date={selectedDate}
          isSubmitting={isSubmitting}
          submitError={submitError}
          onSubmit={handleSubmitValue}
        />
      )}

      {canWriteDueKeys && (
        <FillAllKeysSheet
          open={bulkSheetOpen}
          onOpenChange={(open) => {
            setBulkSheetOpen(open);
            if (!open) clearBulkError();
          }}
          items={activeItems}
          storeId={selectedStoreId ?? ""}
          date={selectedDate}
          isSubmitting={isSubmittingBulk}
          submitError={submitErrorBulk}
          onSubmit={async (payload) => {
            if (!selectedStoreId || !canWriteDueKeys) return false;
            const success = await setDueKeysBulk(selectedStoreId, selectedDate, payload.items);
            if (success) {
              refetch();
            } else {
              if (submitErrorBulk) toast.error(submitErrorBulk);
            }
            return success;
          }}
        />
      )}

      {/* ── Employee Debrief Notes section ──────────────────────────── */}
      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Employee Debrief Notes</h2>
            <p className="text-sm text-muted-foreground">
              Debrief notes for the selected store.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refetchDebriefs}
            disabled={!selectedStoreId || isDebriefLoading || isDebriefRefreshing}
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

        {/* Side-by-side: list (left) + create form (right) */}
        <div>
          {/* Table */}
          <div>
            {isDebriefLoading && !debriefItems.length ? (
              <DebriefTableSkeleton />
            ) : !selectedStoreId ? (
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

      {/* Debrief detail sheet */}
      <EmployeeDebriefDetailSheet
        open={debriefSheetOpen}
        onOpenChange={setDebriefSheetOpen}
        storeId={selectedStoreId ?? ""}
        debriefId={selectedDebrief?.id ?? null}
      />

      {/* Delete confirmation */}
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
