"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeeDebriefDetailSheet } from "@/components/employee-debriefs/employee-debrief-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmployeeDebriefHistory } from "@/lib/hooks/use-employee-debriefs";
import { useEmployeeOperational } from "@/lib/hooks/use-employee-operational";
import { useDueKeys } from "@/lib/hooks/use-due-keys";
import { cn } from "@/lib/utils";
import { AlertCircle, ArrowDownUp, ChevronDown, RefreshCw } from "lucide-react";
import type { EmployeeDebriefItem } from "@/types/employee-debrief.types";
import type { Employee } from "@/types/due-key.types";

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

function formatTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

function employeeDisplayName(emp: Employee): string {
  return [emp.firstName, emp.middleName, emp.lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

function DebriefTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">ID</TableHead>
            <TableHead className="w-32">Date</TableHead>
            <TableHead className="hidden sm:table-cell">Author</TableHead>
            <TableHead className="hidden lg:table-cell">Notes</TableHead>
            <TableHead className="w-24 text-right">Attachments</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
              <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-8" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OperationalTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">Date</TableHead>
            <TableHead>Metric</TableHead>
            <TableHead className="w-32 text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function EmployeeDebriefHistoryPage() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storeSearch, setStoreSearch] = useState("");
  const [storePopoverOpen, setStorePopoverOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false);
  const [today] = useState(formatTodayDate);

  // Tab state
  const [activeTab, setActiveTab] = useState<"debriefs" | "operational">("debriefs");

  // Debrief tab state
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<EmployeeDebriefItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Operational tab state
  const [opPage, setOpPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const parsed = parseAuthUserStores();
    setStores(parsed);
    if (parsed.length > 0) setSelectedStoreId(parsed[0].id);
  }, []);

  // Reset both tabs when store changes
  useEffect(() => {
    setSelectedEmployee(null);
    setPage(1);
    setOpPage(1);
  }, [selectedStoreId]);

  // Reset page counters when employee changes
  useEffect(() => {
    setPage(1);
    setOpPage(1);
  }, [selectedEmployee]);

  // Reset operational page when filters change
  useEffect(() => {
    setOpPage(1);
  }, [dateFrom, dateTo, sortDir]);

  // Employee list from today's due-keys
  const { data: dueKeysData, isLoading: employeesLoading } = useDueKeys(selectedStoreId, today);
  const employees: Employee[] = dueKeysData?.employees ?? [];

  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null;

  const filteredStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) => s.name.toLowerCase().includes(q));
  }, [stores, storeSearch]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => employeeDisplayName(emp).toLowerCase().includes(q));
  }, [employees, employeeSearch]);

  // Debrief hook
  const { items, isLoading, isRefreshing, error, currentPage, lastPage, total, refetch, clearError } =
    useEmployeeDebriefHistory(selectedStoreId, selectedEmployee?.id ?? null, page);

  // Operational hook
  const {
    entries,
    isLoading: opLoading,
    isRefreshing: opRefreshing,
    error: opError,
    currentPage: opCurrentPage,
    lastPage: opLastPage,
    total: opTotal,
    refetch: opRefetch,
    clearError: opClearError,
  } = useEmployeeOperational(selectedStoreId, selectedEmployee?.id ?? null, opPage, {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortDir,
  });

  const hasValidContext = !!selectedStoreId && selectedEmployee != null;

  const activeRefetch = activeTab === "debriefs" ? refetch : opRefetch;
  const activeRefreshing = activeTab === "debriefs" ? isRefreshing : opRefreshing;
  const activeLoading = activeTab === "debriefs" ? isLoading : opLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Debrief History"
        description="View debrief notes and operational history for a specific employee."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={activeRefetch}
          disabled={!hasValidContext || activeLoading || activeRefreshing}
        >
          <RefreshCw className={cn("me-2 h-4 w-4", activeRefreshing && "animate-spin")} />
          {activeRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </PageHeader>

      {/* Shared filters */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Store combobox */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Store</p>
          <Popover open={storePopoverOpen} onOpenChange={setStorePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={storePopoverOpen}
                disabled={stores.length === 0}
                className="w-full justify-between font-normal"
              >
                <span className={cn("truncate", !selectedStore && "text-muted-foreground")}>
                  {selectedStore ? selectedStore.name : "Select store"}
                </span>
                <ChevronDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <Input
                placeholder="Search store..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="mb-2 h-8 text-sm"
              />
              <div className="h-52 overflow-y-auto">
                {filteredStores.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">No stores found.</p>
                ) : (
                  filteredStores.map((store) => (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => {
                        setSelectedStoreId(store.id);
                        setStoreSearch("");
                        setStorePopoverOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                        selectedStoreId === store.id && "bg-accent font-medium"
                      )}
                    >
                      <span className="flex-1 truncate">{store.name}</span>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Employee combobox */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Employee</p>
          <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={employeePopoverOpen}
                disabled={!selectedStoreId || employeesLoading}
                className="w-full justify-between font-normal"
              >
                <span className={cn("truncate", !selectedEmployee && "text-muted-foreground")}>
                  {selectedEmployee
                    ? employeeDisplayName(selectedEmployee)
                    : employeesLoading
                    ? "Loading employees..."
                    : "Select employee"}
                </span>
                <ChevronDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <Input
                placeholder="Search employee..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="mb-2 h-8 text-sm"
              />
              <div className="max-h-52 overflow-y-auto">
                {filteredEmployees.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    {employeesLoading ? "Loading..." : "No employees found."}
                  </p>
                ) : (
                  filteredEmployees.map((emp) => {
                    const name = employeeDisplayName(emp);
                    const isSelected = selectedEmployee?.id === emp.id;
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setEmployeeSearch("");
                          setEmployeePopoverOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                          isSelected && "bg-accent font-medium"
                        )}
                      >
                        <span className="flex-1 truncate">{name}</span>
                        {!emp.active && (
                          <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "debriefs" | "operational")}>
        <TabsList>
          <TabsTrigger value="debriefs">
            Debrief Notes
            {hasValidContext && !isLoading && !error && (
              <Badge variant="secondary" className="ms-2 text-xs">{total}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="operational">
            Operational History
            {hasValidContext && !opLoading && !opError && (
              <Badge variant="secondary" className="ms-2 text-xs">{opTotal}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Debrief Notes tab ── */}
        <TabsContent value="debriefs" className="mt-4" tabIndex={-1}>
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-sm text-destructive">{error}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
                  <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
                </div>
              </div>
            </div>
          )}

          {isLoading && !items.length ? (
            <DebriefTableSkeleton />
          ) : !selectedStoreId ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">
              Select a store to get started.
            </div>
          ) : !selectedEmployee ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">
              Select an employee to load their debrief history.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Author</TableHead>
                    <TableHead className="hidden lg:table-cell">Notes</TableHead>
                    <TableHead className="w-24 text-right">Attachments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No debrief notes found for this employee.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => {
                      const notesPreview = item.notes
                        ? item.notes.length > 80 ? item.notes.slice(0, 80) + "…" : item.notes
                        : null;
                      const attachmentCount = item.attachments?.length ?? 0;
                      return (
                        <TableRow key={item.id} className="cursor-pointer" onClick={() => { setSelectedItem(item); setSheetOpen(true); }}>
                          <TableCell className="font-mono text-sm">{item.id}</TableCell>
                          <TableCell className="text-sm">{formatDate(item.date ?? item.createdAt)}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {item.authorName ? <span className="text-sm">{item.authorName}</span> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="hidden max-w-xs truncate lg:table-cell" title={item.notes ?? undefined}>
                            {notesPreview ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {attachmentCount > 0 ? <Badge variant="secondary">{attachmentCount}</Badge> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {lastPage > 1 && !isLoading && !error && items.length > 0 && (
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={currentPage <= 1 || isLoading}>Previous</Button>
              <span className="text-muted-foreground">Page {currentPage} of {lastPage}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={currentPage >= lastPage || isLoading}>Next</Button>
            </div>
          )}
        </TabsContent>

        {/* ── Operational History tab ── */}
        <TabsContent value="operational" className="mt-4" tabIndex={-1}>
          {/* Date + sort filters */}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">From</p>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-36 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">To</p>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-36 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              className="gap-1.5"
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
              {sortDir === "desc" ? "Newest first" : "Oldest first"}
            </Button>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
              >
                Clear dates
              </Button>
            )}
          </div>

          {/* Error */}
          {opError && (
            <div className="mb-4 flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-sm text-destructive">{opError}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={opRefetch}>Retry</Button>
                  <Button variant="ghost" size="sm" onClick={opClearError}>Dismiss</Button>
                </div>
              </div>
            </div>
          )}

          {opLoading && !entries.length ? (
            <OperationalTableSkeleton />
          ) : !selectedStoreId ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">
              Select a store to get started.
            </div>
          ) : !selectedEmployee ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">
              Select an employee to view their operational history.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Date</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead className="w-32 text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        No operational records found for this employee.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry, i) => (
                      <TableRow key={`${entry.metric_date}-${entry.column_key}-${i}`}>
                        <TableCell className="text-sm">{formatDate(entry.metric_date)}</TableCell>
                        <TableCell className="text-sm">{entry.column_name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {entry.value_numeric != null ? entry.value_numeric : entry.value || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {opLastPage > 1 && !opLoading && !opError && entries.length > 0 && (
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <Button variant="outline" size="sm" onClick={() => setOpPage((p) => p - 1)} disabled={opCurrentPage <= 1 || opLoading}>Previous</Button>
              <span className="text-muted-foreground">Page {opCurrentPage} of {opLastPage}</span>
              <Button variant="outline" size="sm" onClick={() => setOpPage((p) => p + 1)} disabled={opCurrentPage >= opLastPage || opLoading}>Next</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail sheet (debrief tab) */}
      <EmployeeDebriefDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        storeId={selectedStoreId ?? ""}
        debriefId={selectedItem?.id ?? null}
      />
    </div>
  );
}
