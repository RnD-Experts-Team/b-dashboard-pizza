"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  Tag,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventoryEmployees } from "@/lib/hooks/use-inventory-employees";
import type { InventoryType, LinkListParams } from "@/types/inventory.types";

interface LinkFiltersBarProps {
  /** Controlled open state — managed by the parent page. */
  open: boolean;
  /** Only used to populate the employee dropdown — fetched lazily when opened. */
  storeId: string;
  filters: LinkListParams;
  onFiltersChange: (filters: LinkListParams) => void;
  disabled?: boolean;
}

/** Collapsible filter panel for the Links list. The toggle button lives in the page header row. */
export function LinkFiltersBar({
  open,
  storeId,
  filters,
  onFiltersChange,
  disabled,
}: LinkFiltersBarProps) {
  const [empOpen, setEmpOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState("");

  // Lazy — only fetch employees once the panel is actually opened.
  const { options: employeeOptions } = useInventoryEmployees(open ? storeId : null);

  const filteredEmployees = useMemo(() => {
    const q = empSearch.toLowerCase();
    if (!q) return employeeOptions;
    return employeeOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [employeeOptions, empSearch]);

  function updateField<K extends keyof LinkListParams>(
    key: K,
    value: LinkListParams[K]
  ) {
    onFiltersChange({ ...filters, [key]: value, page: 1 });
  }

  if (!open) return null;

  const selectedEmployee =
    filters.employee_id != null
      ? employeeOptions.find((o) => o.value === filters.employee_id)
      : null;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            Date from
          </label>
          <DatePicker
            value={filters.date_from ?? ""}
            onChange={(v) => updateField("date_from", v || undefined)}
            placeholder="YYYY-MM-DD"
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            Date to
          </label>
          <DatePicker
            value={filters.date_to ?? ""}
            onChange={(v) => updateField("date_to", v || undefined)}
            placeholder="YYYY-MM-DD"
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Tag className="h-3 w-3" />
            Type
          </label>
          <Select
            value={filters.type ?? "all"}
            onValueChange={(v) =>
              updateField("type", v === "all" ? undefined : (v as InventoryType))
            }
            disabled={disabled}
          >
            <SelectTrigger
              className={cn("h-9 text-sm", filters.type && "border-primary/40 bg-primary/5")}
            >
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="period">Period</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CircleDot className="h-3 w-3" />
            Status
          </label>
          <Select
            value={filters.status ?? "all"}
            onValueChange={(v) =>
              updateField(
                "status",
                v === "all" ? undefined : (v as "active" | "submitted")
              )
            }
            disabled={disabled}
          >
            <SelectTrigger
              className={cn("h-9 text-sm", filters.status && "border-primary/40 bg-primary/5")}
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="h-3 w-3" />
            Employee
          </label>
          <Popover
            open={empOpen}
            onOpenChange={(next) => {
              setEmpOpen(next);
              if (!next) setEmpSearch("");
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                className={cn(
                  "h-9 w-full justify-between font-normal",
                  filters.employee_id != null && "border-primary/40 bg-primary/5"
                )}
              >
                <span className="truncate text-sm">
                  {selectedEmployee ? selectedEmployee.label : "All employees"}
                </span>
                <ChevronDown
                  className={cn(
                    "ml-2 h-3.5 w-3.5 shrink-0 transition-transform",
                    empOpen && "rotate-180"
                  )}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <Input
                placeholder="Search employee…"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="h-8 mb-2"
                autoFocus
              />
              <div
                className="max-h-52 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/35"
                onWheel={(e) => e.stopPropagation()}
              >
                {filteredEmployees.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No employees found.
                  </p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer select-none hover:bg-muted",
                        filters.employee_id == null && "bg-muted"
                      )}
                      onClick={() => {
                        updateField("employee_id", undefined);
                        setEmpOpen(false);
                        setEmpSearch("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          updateField("employee_id", undefined);
                          setEmpOpen(false);
                          setEmpSearch("");
                        }
                      }}
                    >
                      All employees
                      {filters.employee_id == null && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                    </div>
                    {filteredEmployees.map((opt) => (
                      <div
                        key={opt.value}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer select-none hover:bg-muted",
                          filters.employee_id === opt.value && "bg-muted"
                        )}
                        onClick={() => {
                          updateField("employee_id", Number(opt.value));
                          setEmpOpen(false);
                          setEmpSearch("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            updateField("employee_id", Number(opt.value));
                            setEmpOpen(false);
                            setEmpSearch("");
                          }
                        }}
                      >
                        {opt.label}
                        {filters.employee_id === opt.value && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

/** Returns the number of active filters — use on the external toggle button. */
export function countLinkFilters(filters: LinkListParams): number {
  return [
    filters.date_from,
    filters.date_to,
    filters.type,
    filters.status,
    filters.employee_id,
  ].filter((v) => v != null && v !== "").length;
}
