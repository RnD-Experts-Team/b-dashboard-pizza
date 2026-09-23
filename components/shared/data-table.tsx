"use client";

import { useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  getRowKey?: (item: T, index: number) => React.Key;
  rowClassName?: string | ((item: T) => string);
  // Pagination props
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null;
  onPageChange?: (page: number) => void;
}

export function DataTable<T extends object>({
  data,
  columns,
  isLoading = false,
  searchable = false,
  searchPlaceholder = "Search...",
  onSearchChange,
  emptyMessage = "No results found.",
  onRowClick,
  getRowKey,
  rowClassName,
  pagination,
  onPageChange,
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = useState("");
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      onSearchChangeRef.current?.(searchValue);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchValue]);

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow
                  key={getRowKey ? getRowKey(item, index) : index}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    typeof rowClassName === "function"
                      ? rowClassName(item)
                      : rowClassName
                  )}
                  onClick={(event) => {
                    if (!onRowClick) return;
                    const target = event.target as HTMLElement | null;
                    const ct = event.currentTarget as HTMLElement | null;
                    // React 18 bubbles portal events (e.g. Radix DropdownMenuContent)
                    // through the component tree. Guard against that by checking that
                    // the click originated inside this row's real DOM subtree.
                    if (target && ct && !ct.contains(target)) return;
                    if (target?.closest('[data-no-row-click="true"]')) return;
                    onRowClick(item);
                  }}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(event) => {
                    if (!onRowClick) return;
                    const target = event.target as HTMLElement | null;
                    const ct = event.currentTarget as HTMLElement | null;
                    if (target && ct && !ct.contains(target)) return;
                    if (target?.closest('[data-no-row-click="true"]')) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowClick(item);
                    }
                  }}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.cell
                        ? column.cell(item)
                        : ((item as Record<string, unknown>)[column.key] as React.ReactNode)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && onPageChange && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {pagination.total > 0 ? (
              <>
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
                {pagination.total} entries
              </>
            ) : (
              "0 entries"
            )}
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex w-25 items-center justify-center text-sm font-medium">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => onPageChange(1)}
                disabled={pagination.page <= 1}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => onPageChange(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
