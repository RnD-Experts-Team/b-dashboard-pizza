"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { CreateEmployeeDialog } from "@/components/hiring/create-employee-dialog";
import { EditEmployeeDialog } from "@/components/hiring/edit-employee-dialog";
import { EmployeeDetailsSheet } from "@/components/hiring/employee-details-sheet";
import { employeeService } from "@/lib/api/services/employee.service";
import { hiringService } from "@/lib/api/services/hiring.service";
import { toast } from "sonner";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type {
  EmployeeRecord,
  GetEmployeesParams,
  LegalStatus,
} from "@/types/employee.types";
import type { EmployeeStatusRecord, PositionRecord } from "@/types/hiring.types";

type EmployeeFilterOptions = {
  search?: string;
  legal_status?: LegalStatus | "all";
  position_id?: string;
  emp_status_id?: string;
  paychecks_id?: string;
  city?: string;
  page?: string;
};

function buildEmployeeRequest(opts?: EmployeeFilterOptions): {
  params: GetEmployeesParams;
  pageNum: number;
} {
  const positionId =
    opts?.position_id && opts.position_id !== "all"
      ? parseInt(opts.position_id, 10)
      : undefined;
  const empStatusId =
    opts?.emp_status_id && opts.emp_status_id !== "all"
      ? parseInt(opts.emp_status_id, 10)
      : undefined;
  const paychecksIdNum =
    opts?.paychecks_id && opts.paychecks_id.trim()
      ? parseInt(opts.paychecks_id, 10)
      : undefined;
  const parsedPage =
    opts?.page && opts.page.trim()
      ? parseInt(opts.page, 10)
      : 1;
  const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const params: GetEmployeesParams = {
    ...(opts?.search?.trim() ? { search: opts.search.trim() } : {}),
    ...(Number.isFinite(positionId) ? { position_id: positionId } : {}),
    ...(Number.isFinite(empStatusId) ? { emp_status_id: empStatusId } : {}),
    ...(opts?.legal_status && opts.legal_status !== "all"
      ? { legal_status: opts.legal_status }
      : {}),
    ...(Number.isFinite(paychecksIdNum) ? { paychecks_id: paychecksIdNum } : {}),
    ...(opts?.city?.trim() ? { city: opts.city.trim() } : {}),
    page: pageNum,
  };

  return { params, pageNum };
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {["Name", "Gender", "Birth Date", "Position", "Status", "Legal Status"].map(
              (h) => (
                <TableHead key={h}>{h}</TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 6 }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function legalStatusLabel(status: string) {
  if (status === "w2") return "W-2";
  if (status === "1099") return "1099";
  return status;
}

function employeeStatusLabel(status: string) {
  return status
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word === word.toUpperCase()
        ? word
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join(" ");
}

function getPositionName(positionId: number, positions: PositionRecord[]): string {
  return positions.find((p) => p.id === positionId)?.position_name ?? `Unknown (${positionId})`;
}

function getStatusName(statusId: number, statuses: EmployeeStatusRecord[]): string {
  const status = statuses.find((s) => s.id === statusId)?.emp_status;
  return status ? employeeStatusLabel(status) : `Unknown (${statusId})`;
}

export default function EmployeesPage() {
  const { selectedStore } = useSelectedStoreStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [editEmployeeId, setEditEmployeeId] = useState<number | null>(null);
  const [editEmployee, setEditEmployee] = useState<EmployeeRecord | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rows, setRows] = useState<EmployeeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [isStoreHydrated, setIsStoreHydrated] = useState(
    () => useSelectedStoreStore.persist.hasHydrated(),
  );
  const [resolvedStoreId, setResolvedStoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatusRecord[]>([]);
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  /* Filters */
  const [search, setSearch] = useState("");
  const [legalStatus, setLegalStatus] = useState<LegalStatus | "all">("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paychecksId, setPaychecksId] = useState("");
  const [city, setCity] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  function getCurrentFilters() {
    return {
      search,
      legal_status: legalStatus,
      position_id: positionFilter,
      emp_status_id: statusFilter,
      paychecks_id: paychecksId,
      city,
      page: String(page),
    };
  }

  useEffect(() => {
    const persistApi = useSelectedStoreStore.persist;
    setIsStoreHydrated(persistApi.hasHydrated());

    const unsubscribeHydrate = persistApi.onHydrate(() => {
      setIsStoreHydrated(false);
    });
    const unsubscribeFinishHydration = persistApi.onFinishHydration(() => {
      setIsStoreHydrated(true);
    });

    return () => {
      unsubscribeHydrate();
      unsubscribeFinishHydration();
    };
  }, []);

  const fetchData = useCallback(
    async (opts?: EmployeeFilterOptions) => {
      if (!selectedStore?.storeId) {
        setIsLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const { params, pageNum } = buildEmployeeRequest(opts);

        const res = await employeeService.getEmployees(
          selectedStore.storeId,
          params,
          controller.signal,
        );
        setRows(res.data.employees);
        setTotalPages(res.last_page ?? 1);
        setPage(res.current_page ?? pageNum);
        setTotalItems(res.total ?? res.data.employees.length);
        setPageSize(res.per_page ?? Math.max(res.data.employees.length, 1));
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") return;
        setError(
          err instanceof Error ? err.message : "Failed to load employees.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [selectedStore?.storeId],
  );

  /* Initial load - wait for persisted store hydration, then bootstrap page data */
  useEffect(() => {
    if (!isStoreHydrated) return;

    if (!selectedStore?.storeId) {
      abortRef.current?.abort();
      setRows([]);
      setEmployeeStatuses([]);
      setPositions([]);
      setError(null);
      setIsLoading(false);
      setIsMetadataLoading(false);
      setResolvedStoreId(null);
      setTotalPages(1);
      setPage(1);
      setTotalItems(0);
      return;
    }

    const storeId = selectedStore.storeId;
    const { params, pageNum } = buildEmployeeRequest(getCurrentFilters());

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    const bootstrapPage = async () => {
      setIsLoading(true);
      setIsMetadataLoading(true);
      setError(null);

      const metadataPromise = hiringService
        .getCreateEmployeePage(storeId)
        .then((data) => {
          if (cancelled) return;
          setEmployeeStatuses(data.employeeStatuses);
          setPositions(data.positions);
        })
        .catch(() => {
          if (cancelled) return;
          setEmployeeStatuses([]);
          setPositions([]);
        })
        .finally(() => {
          if (!cancelled) {
            setIsMetadataLoading(false);
          }
        });

      try {
        const res = await employeeService.getEmployees(
          storeId,
          params,
          controller.signal,
        );

        if (cancelled) return;

        setRows(res.data.employees);
        setTotalPages(res.last_page ?? 1);
        setPage(res.current_page ?? pageNum);
        setTotalItems(res.total ?? res.data.employees.length);
        setPageSize(res.per_page ?? Math.max(res.data.employees.length, 1));
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") return;
        if (cancelled) return;

        setRows([]);
        setTotalPages(1);
        setPage(pageNum);
        setTotalItems(0);
        setPageSize(20);
        setError(
          err instanceof Error ? err.message : "Failed to load employees.",
        );
      } finally {
        await metadataPromise;
        if (!cancelled) {
          setIsLoading(false);
          setResolvedStoreId(storeId);
        }
      }
    };

    void bootstrapPage();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStoreHydrated, selectedStore?.storeId]);

  const hasStore = !!selectedStore?.storeId;
  const isBootstrappingCurrentStore =
    hasStore && resolvedStoreId !== selectedStore?.storeId;
  const shouldShowSkeleton =
    !isStoreHydrated || (hasStore && (isLoading || isMetadataLoading || isBootstrappingCurrentStore));
  const isEmpty = hasStore && !shouldShowSkeleton && !error && rows.length === 0;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchData(getCurrentFilters());
  }

  function handleLegalStatusChange(value: string) {
    setLegalStatus(value as LegalStatus | "all");
  }

  function handleClearFilters() {
    setSearch("");
    setLegalStatus("all");
    setPositionFilter("all");
    setStatusFilter("all");
    setPaychecksId("");
    setCity("");
    setPage(1);
    fetchData({
      search: "",
      legal_status: "all",
      position_id: "all",
      emp_status_id: "all",
      paychecks_id: "",
      city: "",
      page: "1",
    });
  }

  const isFiltered =
    search !== "" ||
    legalStatus !== "all" ||
    positionFilter !== "all" ||
    statusFilter !== "all" ||
    paychecksId !== "" ||
    city !== "";

  async function handleDelete() {
    if (deleteEmployeeId === null || !selectedStore?.storeId) return;
    setIsDeleting(true);
    try {
      await employeeService.deleteEmployee(selectedStore.storeId, deleteEmployeeId);
      toast.success("Employee deleted.");
      setDeleteConfirmOpen(false);
      setDeleteEmployeeId(null);
      fetchData(getCurrentFilters());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete employee.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employees"
        description="Manage employees for your stores."
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchData(getCurrentFilters())}
          disabled={shouldShowSkeleton}
          aria-label="Refresh"
        >
          <RefreshCw className={shouldShowSkeleton ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          Add Employee
        </Button>
      </PageHeader>

      {/* Filters */}
      <form
        onSubmit={handleSearch}
        className="rounded-lg border bg-card/40 p-4"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative min-w-0 xl:col-span-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="ps-9"
              placeholder="Search by name, email, or SSN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Input
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            type="number"
            min={1}
            placeholder="Paycheck ID"
            value={paychecksId}
            onChange={(e) => setPaychecksId(e.target.value)}
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)_auto_auto] xl:items-center">
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All positions</SelectItem>
              {positions.map((position) => (
                <SelectItem key={position.id} value={String(position.id)}>
                  {position.position_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Employee status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employee statuses</SelectItem>
              {employeeStatuses.map((status) => (
                <SelectItem key={status.id} value={String(status.id)}>
                  {employeeStatusLabel(status.emp_status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={legalStatus} onValueChange={handleLegalStatusChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Legal status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="w2">W-2</SelectItem>
              <SelectItem value="1099">1099</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" variant="secondary" size="sm" className="xl:justify-self-end">
            Search
          </Button>
          {isFiltered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="xl:justify-self-start"
              onClick={handleClearFilters}
            >
              <X className="me-1 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </form>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(getCurrentFilters())}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Skeleton */}
      {shouldShowSkeleton && <TableSkeleton />}

      {/* No store */}
      {isStoreHydrated && !shouldShowSkeleton && !hasStore && (
        <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
          Select a store to view employees.
        </div>
      )}

      {/* Empty */}
      {isEmpty && (
        <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
          {isFiltered
            ? "No employees match your filters."
            : 'No employees yet. Click "Add Employee" to create one.'}
        </div>
      )}

      {/* Table */}
      {!shouldShowSkeleton && !error && rows.length > 0 && (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Gender</TableHead>
                  <TableHead className="hidden md:table-cell">Birth Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Position</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead>Legal Status</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((emp) => {
                  const profile = emp.employee_profile;
                  const fullName = profile
                    ? [profile.first_name, profile.middle_name, profile.last_name]
                        .filter(Boolean)
                        .join(" ")
                    : `Employee #${emp.id}`;

                  const primaryPaycheck =
                    emp.employee_paychecks_info.find((p) => p.is_primary) ??
                    emp.employee_paychecks_info[0];

                  return (
                    <TableRow
                      key={emp.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setSelectedEmployeeId(emp.id);
                        setDetailsOpen(true);
                      }}
                    >
                      <TableCell>
                        <div className="font-medium text-sm">{fullName}</div>
                        {profile && (
                          <div className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                            {profile.gender ? `${profile.gender.charAt(0).toUpperCase()}${profile.gender.slice(1)}` : "—"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell capitalize text-sm">
                        {profile?.gender ?? "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm whitespace-nowrap">
                        {profile?.birth_date ?? "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {getPositionName(emp.position_id, positions)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {getStatusName(emp.emp_status_id, employeeStatuses)}
                      </TableCell>
                      <TableCell>
                        {primaryPaycheck?.legal_status ? (
                          <Badge variant="secondary" className="text-xs">
                            {legalStatusLabel(primaryPaycheck.legal_status)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditEmployee(emp);
                                setEditEmployeeId(emp.id);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="me-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setDeleteEmployeeId(emp.id);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="me-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <div className="flex-1 text-sm text-muted-foreground">
                {totalItems > 0 ? (
                  <>
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalItems)} of {totalItems} entries
                  </>
                ) : (
                  "0 entries"
                )}
              </div>
              <div className="flex items-center space-x-6 lg:space-x-8">
                <div className="flex w-25 items-center justify-center text-sm font-medium">
                  Page {page} of {totalPages}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() =>
                      fetchData({
                        ...getCurrentFilters(),
                        page: "1",
                      })
                    }
                    disabled={page <= 1}
                  >
                    <span className="sr-only">Go to first page</span>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      fetchData({
                        ...getCurrentFilters(),
                        page: String(page - 1),
                      })
                    }
                    disabled={page <= 1}
                  >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      fetchData({
                        ...getCurrentFilters(),
                        page: String(page + 1),
                      })
                    }
                    disabled={page >= totalPages}
                  >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() =>
                      fetchData({
                        ...getCurrentFilters(),
                        page: String(totalPages),
                      })
                    }
                    disabled={page >= totalPages}
                  >
                    <span className="sr-only">Go to last page</span>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <CreateEmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => fetchData(getCurrentFilters())}
      />

      <EmployeeDetailsSheet
        employeeId={selectedEmployeeId}
        employee={selectedEmployee}
        open={detailsOpen}
        onOpenChange={(nextOpen) => {
          setDetailsOpen(nextOpen);
          if (!nextOpen) {
            setSelectedEmployeeId(null);
            setSelectedEmployee(null);
          }
        }}
        positions={positions}
        employeeStatuses={employeeStatuses}
      />

      <EditEmployeeDialog
        employeeId={editEmployeeId}
        employee={editEmployee}
        open={editDialogOpen}
        onOpenChange={(nextOpen) => {
          setEditDialogOpen(nextOpen);
          if (!nextOpen) {
            setEditEmployeeId(null);
            setEditEmployee(null);
          }
        }}
        onSuccess={() => fetchData(getCurrentFilters())}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Employee #{deleteEmployeeId} will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

