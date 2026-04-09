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
import { Plus, RefreshCw, AlertCircle, Search, X, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { employeeService } from "@/lib/api/services/employee.service";
import { hiringService } from "@/lib/api/services/hiring.service";
import { toast } from "sonner";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { EmployeeRecord, LegalStatus } from "@/types/employee.types";
import type { EmployeeStatusRecord, PositionRecord } from "@/types/hiring.types";

function TableSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {["ID", "Name", "Gender", "Birth Date", "Position", "Status", "Legal Status"].map(
              (h) => (
                <TableHead key={h}>{h}</TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 7 }).map((_, j) => (
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

function getPositionName(positionId: number, positions: PositionRecord[]): string {
  return positions.find((p) => p.id === positionId)?.position_name ?? `Unknown (${positionId})`;
}

function getStatusName(statusId: number, statuses: EmployeeStatusRecord[]): string {
  return statuses.find((s) => s.id === statusId)?.emp_status ?? `Unknown (${statusId})`;
}

export default function EmployeesPage() {
  const { selectedStore } = useSelectedStoreStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rows, setRows] = useState<EmployeeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatusRecord[]>([]);
  const [positions, setPositions] = useState<PositionRecord[]>([]);

  /* Filters */
  const [search, setSearch] = useState("");
  const [legalStatus, setLegalStatus] = useState<LegalStatus | "all">("all");

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (opts?: { search?: string; legal_status?: LegalStatus | "all" }) => {
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
        const res = await employeeService.getEmployees(
          selectedStore.storeId,
          {
            ...(opts?.search ? { search: opts.search } : {}),
            ...(opts?.legal_status && opts.legal_status !== "all"
              ? { legal_status: opts.legal_status }
              : {}),
          },
          controller.signal,
        );
        setRows(res.data.employees);
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

  /* Initial load - fetch employees and metadata */
  useEffect(() => {
    fetchData({ search, legal_status: legalStatus });
    
    if (selectedStore?.storeId) {
      hiringService
        .getCreateEmployeePage(selectedStore.storeId)
        .then((data) => {
          setEmployeeStatuses(data.employeeStatuses);
          setPositions(data.positions);
        })
        .catch(() => {});
    }
    
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, selectedStore?.storeId]);

  const hasStore = !!selectedStore?.storeId;
  const isEmpty = hasStore && !isLoading && !error && rows.length === 0;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchData({ search, legal_status: legalStatus });
  }

  function handleLegalStatusChange(value: string) {
    const next = value as LegalStatus | "all";
    setLegalStatus(next);
    fetchData({ search, legal_status: next });
  }

  function handleClearFilters() {
    setSearch("");
    setLegalStatus("all");
    fetchData({});
  }

  const isFiltered = search !== "" || legalStatus !== "all";

  async function handleDelete() {
    if (deleteEmployeeId === null || !selectedStore?.storeId) return;
    setIsDeleting(true);
    try {
      await employeeService.deleteEmployee(selectedStore.storeId, deleteEmployeeId);
      toast.success("Employee deleted.");
      setDeleteConfirmOpen(false);
      setDeleteEmployeeId(null);
      fetchData({ search, legal_status: legalStatus });
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
          onClick={() => fetchData({ search, legal_status: legalStatus })}
          disabled={isLoading}
          aria-label="Refresh"
        >
          <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          Add Employee
        </Button>
      </PageHeader>

      {/* Filters */}
      <form
        onSubmit={handleSearch}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="relative flex-1 min-w-48">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="ps-9"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={legalStatus} onValueChange={handleLegalStatusChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Legal status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="w2">W-2</SelectItem>
            <SelectItem value="1099">1099</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
          >
            <X className="me-1 h-4 w-4" />
            Clear
          </Button>
        )}
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
              onClick={() => fetchData({ search, legal_status: legalStatus })}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Skeleton */}
      {isLoading && <TableSkeleton />}

      {/* No store */}
      {!isLoading && !hasStore && (
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
      {!isLoading && !error && rows.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
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

                const legalStatuses = emp.employee_paychecks_info.map(
                  (p) => p.legal_status,
                );
                const primaryPaycheck =
                  emp.employee_paychecks_info.find((p) => p.is_primary) ??
                  emp.employee_paychecks_info[0];

                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {emp.id}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{fullName}</div>
                      {profile && (
                        <div className="text-xs text-muted-foreground capitalize mt-0.5 sm:hidden">
                          {profile.gender}
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
                    <TableCell>
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
      )}

      <CreateEmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => fetchData({ search, legal_status: legalStatus })}
      />

      <EditEmployeeDialog
        employeeId={editEmployeeId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => fetchData({ search, legal_status: legalStatus })}
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

