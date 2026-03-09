"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { DueKeyValueSheet } from "@/components/due-keys/due-key-value-sheet";
import { FillAllKeysSheet } from "@/components/due-keys/fill-all-keys-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useDueKeys, useSetDueKeyValue, useSetDueKeysBulk } from "@/lib/hooks/use-due-keys";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import type { DueKeyItem, DueKeyValuePayload } from "@/types/due-key.types";

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

  const [selectedItem, setSelectedItem] = useState<DueKeyItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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
            <SelectContent>
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
    </div>
  );
}
