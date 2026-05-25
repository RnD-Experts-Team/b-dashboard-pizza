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
  UserCog,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { CreateEmployeeDialog } from "@/components/hiring/create-employee-dialog";
import { EditEmployeeDialog } from "@/components/hiring/edit-employee-dialog";
import { EmployeeDetailsSheet } from "@/components/hiring/employee-details-sheet";
import { ReferenceCatalogDialog } from "@/components/hiring/reference-catalog-dialog";
import { ChangeEmployeeStatusDialog } from "@/components/hiring/change-employee-status-dialog";
import { employeeService } from "@/lib/api/services/employee.service";
import { referenceCatalogService } from "@/lib/api/services/reference-catalog.service";
import { toast } from "sonner";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useReferenceCatalogStore } from "@/lib/store/reference-catalog.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import type { EmployeeV1Record } from "@/types/employee.types";

type EmployeeFilterOptions = {
  q?: string;
  employee_id?: string;
  gender?: "male" | "female" | "all";
  employment_type?: "W2" | "1099" | "all";
  status_in?: string[];
  position_id?: string;
  marital_id?: string;
  id_type_id?: string;
  attachment_type_id?: string;
  day_of_week?: string;
  shift_type?: "AM" | "PM" | "OP" | "all";
  base_pay_min?: string;
  base_pay_max?: string;
  performance_pay_min?: string;
  performance_pay_max?: string;
  effective_pay_from?: string;
  effective_pay_to?: string;
  birth_from?: string;
  birth_to?: string;
  race?: string;
  religion?: string;
  account_type?: "checking" | "savings" | "all";
  has_primary_email?: "true" | "false" | "all";
  has_primary_phone?: "true" | "false" | "all";
  is_active?: "true" | "false" | "all";
  created_from?: string;
  created_to?: string;
  updated_from?: string;
  updated_to?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  per_page?: number;
  page?: number;
};

const DEFAULT_FILTERS: EmployeeFilterOptions = {
  q: "",
  employee_id: "",
  gender: "all",
  employment_type: "all",
  status_in: [],
  position_id: "",
  marital_id: "",
  id_type_id: "",
  attachment_type_id: "",
  day_of_week: "all",
  shift_type: "all",
  base_pay_min: "",
  base_pay_max: "",
  performance_pay_min: "",
  performance_pay_max: "",
  effective_pay_from: "",
  effective_pay_to: "",
  birth_from: "",
  birth_to: "",
  race: "all",
  religion: "all",
  account_type: "all",
  has_primary_email: "all",
  has_primary_phone: "all",
  is_active: "all",
  created_from: "",
  created_to: "",
  updated_from: "",
  updated_to: "",
  sort_by: "none",
  sort_dir: "desc",
  per_page: 25,
  page: 1,
};

function buildV1Params(opts?: EmployeeFilterOptions): Record<string, string | number | boolean | string[]> {
  const p: Record<string, string | number | boolean | string[]> = {};
  if (opts?.q?.trim()) p.q = opts.q.trim();
  if (opts?.employee_id?.trim()) p.employee_id = opts.employee_id.trim();
  if (opts?.gender && opts.gender !== "all") p.gender = opts.gender;
  if (opts?.employment_type && opts.employment_type !== "all") p.employment_type = opts.employment_type;
  const _statuses = opts?.status_in ?? [];
  if (_statuses.length === 1) {
    p.status = _statuses[0];
  } else if (_statuses.length > 1) {
    p["status_in"] = _statuses;
  }
  if (opts?.position_id?.trim()) p.position_id = opts.position_id.trim();
  if (opts?.marital_id?.trim()) p.marital_id = opts.marital_id.trim();
  if (opts?.id_type_id?.trim()) p.id_type_id = opts.id_type_id.trim();
  if (opts?.attachment_type_id?.trim()) p.attachment_type_id = opts.attachment_type_id.trim();
  if (opts?.day_of_week && opts.day_of_week !== "all") p.day_of_week = opts.day_of_week;
  if (opts?.shift_type && opts.shift_type !== "all") p.shift_type = opts.shift_type;
  if (opts?.base_pay_min?.trim()) p.base_pay_min = opts.base_pay_min.trim();
  if (opts?.base_pay_max?.trim()) p.base_pay_max = opts.base_pay_max.trim();
  if (opts?.performance_pay_min?.trim()) p.performance_pay_min = opts.performance_pay_min.trim();
  if (opts?.performance_pay_max?.trim()) p.performance_pay_max = opts.performance_pay_max.trim();
  if (opts?.effective_pay_from?.trim()) p.effective_pay_from = opts.effective_pay_from.trim();
  if (opts?.effective_pay_to?.trim()) p.effective_pay_to = opts.effective_pay_to.trim();
  if (opts?.birth_from?.trim()) p.birth_from = opts.birth_from.trim();
  if (opts?.birth_to?.trim()) p.birth_to = opts.birth_to.trim();
  if (opts?.race && opts.race !== "all") p.race = opts.race;
  if (opts?.religion && opts.religion !== "all") p.religion = opts.religion;
  if (opts?.account_type && opts.account_type !== "all") p.account_type = opts.account_type;
  if (opts?.has_primary_email && opts.has_primary_email !== "all") p.has_primary_email = opts.has_primary_email === "true";
  if (opts?.has_primary_phone && opts.has_primary_phone !== "all") p.has_primary_phone = opts.has_primary_phone === "true";
  if (opts?.is_active && opts.is_active !== "all") p.is_active = opts.is_active === "true";
  if (opts?.created_from?.trim()) p.created_from = opts.created_from.trim();
  if (opts?.created_to?.trim()) p.created_to = opts.created_to.trim();
  if (opts?.updated_from?.trim()) p.updated_from = opts.updated_from.trim();
  if (opts?.updated_to?.trim()) p.updated_to = opts.updated_to.trim();
  if (opts?.sort_by && opts.sort_by !== "none") p.sort_by = opts.sort_by;
  if (opts?.sort_dir) p.sort_dir = opts.sort_dir;
  if (opts?.per_page) p.per_page = opts.per_page;
  p.page = opts?.page ?? 1;
  return p;
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {["Name", "Gender", "Emp. Type", "Created"].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 4 }).map((_, j) => (
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


export default function EmployeesPage() {
  const { selectedStore } = useSelectedStoreStore();
  const { canAccessRoute, overviewStores } = useAuthStore();
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;

  // Permission checks — mirror sidebar auth-rule requirements
  const canViewEmployees = canAccessRoute({ service: "Hiring", method: "GET", path: "/v1/stores/*/employees", storeId: effectiveStoreId });
  const canViewEmployeeDetails = canAccessRoute({ service: "Hiring", method: "GET", path: "/v1/stores/*/employees/*", storeId: effectiveStoreId });
  const canCreateEmployee = canAccessRoute({ service: "Hiring", method: "POST", path: "/v1/stores/*/employees", storeId: effectiveStoreId });
  const canEditEmployee = canAccessRoute({ service: "Hiring", method: "POST", path: "/v1/stores/*/employees/*", storeId: effectiveStoreId });
  const canChangeEmployeeStatus = canAccessRoute({ service: "Hiring", method: "PATCH", path: "/v1/stores/*/employees/*/status", storeId: effectiveStoreId });
  const canSyncCatalog = canAccessRoute({ service: "Hiring", method: "PUT", path: "/v1/reference-catalog", storeId: effectiveStoreId });
  const {
    positions: catalogPositions,
    maritalStatuses: catalogMaritalStatuses,
    idTypes: catalogIdTypes,
    attachmentTypes: catalogAttachmentTypes,
    setData: setCatalogData,
    setLoading: setCatalogLoading,
    setError: setCatalogError,
  } = useReferenceCatalogStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [editEmployeeId, setEditEmployeeId] = useState<number | null>(null);
  const [changeStatusOpen, setChangeStatusOpen] = useState(false);
  const [changeStatusEmployeeId, setChangeStatusEmployeeId] = useState<number | null>(null);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [rows, setRows] = useState<EmployeeV1Record[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStoreHydrated, setIsStoreHydrated] = useState(
    () => useSelectedStoreStore.persist.hasHydrated(),
  );
  const [resolvedStoreId, setResolvedStoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  /* Filters */
  const [filters, setFilters] = useState<EmployeeFilterOptions>({ ...DEFAULT_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  function getCurrentFilters(): EmployeeFilterOptions {
    return { ...filters, page };
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

  /* Fetch reference catalog on every page mount */
  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoading(true);
    referenceCatalogService
      .getAll(controller.signal)
      .then((res) => setCatalogData(res.data))
      .catch((err) => {
        if (err instanceof Error && err.name === "CanceledError") return;
        console.error("[ReferenceCatalog] Failed to load:", err);
        setCatalogError(
          err instanceof Error ? err.message : "Failed to load reference catalog.",
        );
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const params = buildV1Params(opts);

        const res = await employeeService.getEmployeesV1(
          selectedStore.storeId,
          params,
          controller.signal,
        );
        setRows(res.data);
        setTotalPages(res.last_page ?? 1);
        setPage(res.current_page ?? (Number(params.page) || 1));
        setTotalItems(res.total ?? res.data.length);
        setPageSize(res.per_page ?? Math.max(res.data.length, 1));
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
      setError(null);
      setIsLoading(false);
      setResolvedStoreId(null);
      setTotalPages(1);
      setPage(1);
      setTotalItems(0);
      return;
    }

    const storeId = selectedStore.storeId;
    const params = buildV1Params(getCurrentFilters());

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    const bootstrapPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await employeeService.getEmployeesV1(
          storeId,
          params,
          controller.signal,
        );

        if (cancelled) return;

        setRows(res.data);
        setTotalPages(res.last_page ?? 1);
        setPage(res.current_page ?? (Number(params.page) || 1));
        setTotalItems(res.total ?? res.data.length);
        setPageSize(res.per_page ?? Math.max(res.data.length, 1));
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") return;
        if (cancelled) return;

        setRows([]);
        setTotalPages(1);
        setPage(Number(params.page) || 1);
        setTotalItems(0);
        setPageSize(20);
        setError(
          err instanceof Error ? err.message : "Failed to load employees.",
        );
      } finally {
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
    !isStoreHydrated || (hasStore && (isLoading || isBootstrappingCurrentStore));
  const isEmpty = hasStore && !shouldShowSkeleton && !error && rows.length === 0;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchData(getCurrentFilters());
  }

  function handleClearFilters() {
    const reset = { ...DEFAULT_FILTERS, page: 1 };
    setFilters(reset);
    setPage(1);
    fetchData(reset);
  }

  const activeFilterCount = [
    filters.q?.trim(),
    filters.employee_id?.trim(),
    filters.gender !== "all" ? filters.gender : null,
    filters.employment_type !== "all" ? filters.employment_type : null,
    (filters.status_in?.length ?? 0) > 0 ? filters.status_in![0] : null,
    filters.position_id?.trim(),
    filters.marital_id?.trim(),
    filters.id_type_id?.trim(),
    filters.attachment_type_id?.trim(),
    filters.day_of_week && filters.day_of_week !== "all" ? filters.day_of_week : null,
    filters.shift_type !== "all" ? filters.shift_type : null,
    filters.base_pay_min?.trim(),
    filters.base_pay_max?.trim(),
    filters.performance_pay_min?.trim(),
    filters.performance_pay_max?.trim(),
    filters.effective_pay_from?.trim(),
    filters.effective_pay_to?.trim(),
    filters.birth_from?.trim(),
    filters.birth_to?.trim(),
    filters.race !== "all" ? filters.race : null,
    filters.religion !== "all" ? filters.religion : null,
    filters.account_type !== "all" ? filters.account_type : null,
    filters.has_primary_email !== "all" ? filters.has_primary_email : null,
    filters.has_primary_phone !== "all" ? filters.has_primary_phone : null,
    filters.is_active !== "all" ? filters.is_active : null,
    filters.created_from?.trim(),
    filters.created_to?.trim(),
    filters.updated_from?.trim(),
    filters.updated_to?.trim(),
  ].filter(Boolean).length;

  const isFiltered = activeFilterCount > 0;



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
        {canSyncCatalog && (
          <Button
            variant="outline"
            onClick={() => setCatalogDialogOpen(true)}
          >
            <RefreshCw className="me-2 h-4 w-4" />
            Sync Catalog
          </Button>
        )}
        {canCreateEmployee && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            Add Employee
          </Button>
        )}
      </PageHeader>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-col gap-3">
        {/* Top bar */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="ps-9"
              placeholder="Search by name or SSN..."
              value={filters.q ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>

          {/* Sort controls */}
          <Select
            value={filters.sort_by ?? "none"}
            onValueChange={(v) => setFilters((f) => ({ ...f, sort_by: v }))}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sort by…</SelectItem>
              <SelectItem value="id">ID</SelectItem>
              <SelectItem value="first_name">First name</SelectItem>
              <SelectItem value="last_name">Last name</SelectItem>
              <SelectItem value="employment_type">Emp. type</SelectItem>
              <SelectItem value="gender">Gender</SelectItem>
              <SelectItem value="created_at">Created</SelectItem>
              <SelectItem value="updated_at">Updated</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.sort_dir ?? "desc"}
            onValueChange={(v) => setFilters((f) => ({ ...f, sort_dir: v as "asc" | "desc" }))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Asc ↑</SelectItem>
              <SelectItem value="desc">Desc ↓</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={String(filters.per_page ?? 25)}
            onValueChange={(v) => setFilters((f) => ({ ...f, per_page: Number(v) }))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
            </SelectContent>
          </Select>

          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="contents">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="h-5 min-w-5 px-1 text-xs">{activeFilterCount}</Badge>
                )}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          <Button type="submit" variant="default" size="default">
            Apply
          </Button>

          {isFiltered && (
            <Button type="button" variant="ghost" size="default" onClick={handleClearFilters}>
              <X className="me-1 h-4 w-4" />
              Clear all
            </Button>
          )}
        </div>

        {/* Expandable panel */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent className="rounded-lg border bg-card/40">
            <Tabs defaultValue="employee" className="w-full">
              <div className="px-4 pt-3 pb-0 border-b">
                <TabsList className="h-9 bg-transparent gap-1 p-0">
                  {[
                    { value: "employee", label: "Employee" },
                    { value: "personal", label: "Personal" },
                    { value: "schedule", label: "Schedule" },
                    { value: "pay", label: "Pay" },
                    { value: "dates", label: "Dates & Flags" },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-9 px-3 text-sm"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* ── Employee tab ── */}
              <TabsContent value="employee" className="p-4 mt-0">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {/* Employee ID */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Employee ID</Label>
                    <Input
                      placeholder="e.g. 42"
                      value={filters.employee_id ?? ""}
                      onChange={(e) => setFilters((f) => ({ ...f, employee_id: e.target.value }))}
                    />
                  </div>

                  {/* Position */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Position</Label>
                    <Select
                      value={filters.position_id ?? "all"}
                      onValueChange={(v) => setFilters((f) => ({ ...f, position_id: v === "all" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All positions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All positions</SelectItem>
                        {catalogPositions.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gender */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Gender</Label>
                    <div className="flex rounded-lg bg-muted/60 p-0.5 h-9 gap-0.5">
                      {(["all", "male", "female"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setFilters((f) => ({ ...f, gender: v }))}
                          className={`flex-1 text-xs capitalize rounded-md transition-all ${
                            filters.gender === v
                              ? "bg-white text-gray-900 shadow-sm font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {v === "all" ? "All" : v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Employment Type */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Employment Type</Label>
                    <div className="flex rounded-lg bg-muted/60 p-0.5 h-9 gap-0.5">
                      {(["all", "W2", "1099"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setFilters((f) => ({ ...f, employment_type: v }))}
                          className={`flex-1 text-xs rounded-md transition-all ${
                            filters.employment_type === v
                              ? "bg-white text-gray-900 shadow-sm font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {v === "all" ? "All" : v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between font-normal h-9 px-3 text-sm"
                        >
                          <span className="truncate text-start">
                            {(filters.status_in?.length ?? 0) === 0
                              ? "All statuses"
                              : filters.status_in!.length === 1
                              ? filters.status_in![0].charAt(0).toUpperCase() + filters.status_in![0].slice(1)
                              : `${filters.status_in!.length} statuses`}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44 p-1">
                        {(["hired", "resigned", "terminated", "rehired", "OJE"] as const).map((v) => {
                          const isSelected = filters.status_in?.includes(v) ?? false;
                          return (
                            <DropdownMenuItem
                              key={v}
                              onSelect={(e) => {
                                e.preventDefault();
                                setFilters((f) => {
                                  const current = f.status_in ?? [];
                                  const next = current.includes(v)
                                    ? current.filter((s) => s !== v)
                                    : [...current, v];
                                  return { ...f, status_in: next };
                                });
                              }}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => undefined}
                                className="pointer-events-none"
                              />
                              <span className="capitalize">{v}</span>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </TabsContent>

              {/* ── Personal tab ── */}
              <TabsContent value="personal" className="p-4 mt-0">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {/* Race */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Race</Label>
                    <Select
                      value={filters.race ?? "all"}
                      onValueChange={(v) => setFilters((f) => ({ ...f, race: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="Caucasian">Caucasian</SelectItem>
                        <SelectItem value="African American">African American</SelectItem>
                        <SelectItem value="Hispanic">Hispanic</SelectItem>
                        <SelectItem value="Asian">Asian</SelectItem>
                        <SelectItem value="Native American">Native American</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Religion */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Religion</Label>
                    <Select
                      value={filters.religion ?? "all"}
                      onValueChange={(v) => setFilters((f) => ({ ...f, religion: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="Christianity">Christianity</SelectItem>
                        <SelectItem value="Islam">Islam</SelectItem>
                        <SelectItem value="Judaism">Judaism</SelectItem>
                        <SelectItem value="Buddhism">Buddhism</SelectItem>
                        <SelectItem value="Hinduism">Hinduism</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Marital Status */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Marital Status</Label>
                    <Select
                      value={filters.marital_id ?? "all"}
                      onValueChange={(v) => setFilters((f) => ({ ...f, marital_id: v === "all" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {catalogMaritalStatuses.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ID Type */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">ID Type</Label>
                    <Select
                      value={filters.id_type_id ?? "all"}
                      onValueChange={(v) => setFilters((f) => ({ ...f, id_type_id: v === "all" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {catalogIdTypes.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Attachment Type */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Attachment Type</Label>
                    <Select
                      value={filters.attachment_type_id ?? "all"}
                      onValueChange={(v) => setFilters((f) => ({ ...f, attachment_type_id: v === "all" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {catalogAttachmentTypes.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Birth From */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Birth — From</Label>
                    <Input
                      type="date"
                      value={filters.birth_from ?? ""}
                      onChange={(e) => setFilters((f) => ({ ...f, birth_from: e.target.value }))}
                    />
                  </div>

                  {/* Birth To */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Birth — To</Label>
                    <Input
                      type="date"
                      value={filters.birth_to ?? ""}
                      onChange={(e) => setFilters((f) => ({ ...f, birth_to: e.target.value }))}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ── Schedule tab ── */}
              <TabsContent value="schedule" className="p-4 mt-0">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Day of week */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Day of Week</Label>
                    <Select
                      value={filters.day_of_week ?? "all"}
                      onValueChange={(v) => setFilters((f) => ({ ...f, day_of_week: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any day</SelectItem>
                        {["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((d) => (
                          <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Shift Type */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Shift Type</Label>
                    <div className="flex rounded-lg bg-muted/60 p-0.5 h-9 gap-0.5">
                      {(["all", "AM", "PM", "OP"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setFilters((f) => ({ ...f, shift_type: v }))}
                          className={`flex-1 text-xs rounded-md transition-all ${
                            filters.shift_type === v
                              ? "bg-white text-gray-900 shadow-sm font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {v === "all" ? "All" : v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Pay tab ── */}
              <TabsContent value="pay" className="p-4 mt-0">
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Base Pay */}
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground font-medium">Base Pay ($)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.base_pay_min ?? ""}
                        onChange={(e) => setFilters((f) => ({ ...f, base_pay_min: e.target.value }))}
                      />
                      <span className="text-muted-foreground text-sm">—</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.base_pay_max ?? ""}
                        onChange={(e) => setFilters((f) => ({ ...f, base_pay_max: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Performance Pay */}
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground font-medium">Performance Pay ($)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.performance_pay_min ?? ""}
                        onChange={(e) => setFilters((f) => ({ ...f, performance_pay_min: e.target.value }))}
                      />
                      <span className="text-muted-foreground text-sm">—</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.performance_pay_max ?? ""}
                        onChange={(e) => setFilters((f) => ({ ...f, performance_pay_max: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Effective Pay From */}
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground font-medium">Effective Pay Date</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={filters.effective_pay_from ?? ""}
                        onChange={(e) => setFilters((f) => ({ ...f, effective_pay_from: e.target.value }))}
                      />
                      <span className="text-muted-foreground text-sm">—</span>
                      <Input
                        type="date"
                        value={filters.effective_pay_to ?? ""}
                        onChange={(e) => setFilters((f) => ({ ...f, effective_pay_to: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Dates & Flags tab ── */}
              <TabsContent value="dates" className="p-4 mt-0">
                <div className="flex flex-col gap-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Created */}
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground font-medium">Created</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={filters.created_from ?? ""}
                          onChange={(e) => setFilters((f) => ({ ...f, created_from: e.target.value }))}
                        />
                        <span className="text-muted-foreground text-sm">—</span>
                        <Input
                          type="date"
                          value={filters.created_to ?? ""}
                          onChange={(e) => setFilters((f) => ({ ...f, created_to: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Updated */}
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground font-medium">Updated</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={filters.updated_from ?? ""}
                          onChange={(e) => setFilters((f) => ({ ...f, updated_from: e.target.value }))}
                        />
                        <span className="text-muted-foreground text-sm">—</span>
                        <Input
                          type="date"
                          value={filters.updated_to ?? ""}
                          onChange={(e) => setFilters((f) => ({ ...f, updated_to: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Account Type */}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Account Type</Label>
                      <div className="flex rounded-lg bg-muted/60 p-0.5 h-9 gap-0.5">
                        {(["all", "checking", "savings"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFilters((f) => ({ ...f, account_type: v }))}
                            className={`flex-1 text-xs capitalize rounded-md transition-all ${
                              filters.account_type === v
                                ? "bg-white text-gray-900 shadow-sm font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {v === "all" ? "All" : v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Has Primary Email */}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Has Primary Email</Label>
                      <div className="flex rounded-lg bg-muted/60 p-0.5 h-9 gap-0.5">
                        {(["all", "true", "false"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFilters((f) => ({ ...f, has_primary_email: v }))}
                            className={`flex-1 text-xs rounded-md transition-all ${
                              filters.has_primary_email === v
                                ? "bg-white text-gray-900 shadow-sm font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {v === "all" ? "Any" : v === "true" ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Has Primary Phone */}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Has Primary Phone</Label>
                      <div className="flex rounded-lg bg-muted/60 p-0.5 h-9 gap-0.5">
                        {(["all", "true", "false"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFilters((f) => ({ ...f, has_primary_phone: v }))}
                            className={`flex-1 text-xs rounded-md transition-all ${
                              filters.has_primary_phone === v
                                ? "bg-white text-gray-900 shadow-sm font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {v === "all" ? "Any" : v === "true" ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Is Active */}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Is Active</Label>
                      <div className="flex rounded-lg bg-muted/60 p-0.5 h-9 gap-0.5">
                        {(["all", "true", "false"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFilters((f) => ({ ...f, is_active: v }))}
                            className={`flex-1 text-xs rounded-md transition-all ${
                              filters.is_active === v
                                ? "bg-white text-gray-900 shadow-sm font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {v === "all" ? "Any" : v === "true" ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>
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
                  <TableHead>Emp. Type</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((emp) => {
                  const fullName = [emp.first_name, emp.middle_name, emp.last_name]
                    .filter(Boolean)
                    .join(" ") || `Employee #${emp.id}`;

                  const createdDate = emp.created_at
                    ? new Date(emp.created_at).toLocaleDateString()
                    : "—";

                  return (
                    <TableRow
                      key={emp.id}
                      className={canViewEmployeeDetails ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={canViewEmployeeDetails ? () => {
                        setSelectedEmployeeId(emp.id);
                        setDetailsOpen(true);
                      } : undefined}
                    >
                      <TableCell>
                        <div className="font-medium text-sm">{fullName}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground sm:hidden capitalize">
                          {emp.gender ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell capitalize text-sm">
                        {emp.gender ?? "—"}
                      </TableCell>
                      <TableCell>
                        {emp.employment_type ? (
                          <Badge variant="secondary" className="text-xs">
                            {emp.employment_type}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm whitespace-nowrap">
                        {createdDate}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {(canEditEmployee || canChangeEmployeeStatus) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEditEmployee && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditEmployeeId(emp.id);
                                    setEditDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="me-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canChangeEmployeeStatus && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setChangeStatusEmployeeId(emp.id);
                                    setChangeStatusOpen(true);
                                  }}
                                >
                                  <UserCog className="me-2 h-4 w-4" />
                                  Change Employee Status
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
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
                        page: 1,
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
                        page: page - 1,
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
                        page: page + 1,
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
                        page: totalPages,
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
        open={detailsOpen}
        onOpenChange={(nextOpen) => {
          setDetailsOpen(nextOpen);
          if (!nextOpen) {
            setSelectedEmployeeId(null);
          }
        }}
      />

      <EditEmployeeDialog
        employeeId={editEmployeeId}
        open={editDialogOpen}
        onOpenChange={(nextOpen) => {
          setEditDialogOpen(nextOpen);
          if (!nextOpen) {
            setEditEmployeeId(null);
          }
        }}
        onSuccess={() => fetchData(getCurrentFilters())}
      />

      <ReferenceCatalogDialog
        open={catalogDialogOpen}
        onOpenChange={setCatalogDialogOpen}
      />

      <ChangeEmployeeStatusDialog
        employeeId={changeStatusEmployeeId}
        open={changeStatusOpen}
        onOpenChange={(nextOpen) => {
          setChangeStatusOpen(nextOpen);
          if (!nextOpen) setChangeStatusEmployeeId(null);
        }}
        onSuccess={() => fetchData(getCurrentFilters())}
      />
    </div>
  );
}

