"use client";

import { useCallback, useMemo } from "react";
import { useAuthStore } from "@/lib/auth/auth.store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, Search } from "lucide-react";

interface CameraFormsListFiltersProps {
  filters: {
    dateFrom: string;
    dateTo: string;
    storeId: number | undefined;
  };
  isLoading: boolean;
  onSetFilters: (
    filters: Partial<{
      dateFrom: string;
      dateTo: string;
      storeId: number | undefined;
    }>
  ) => void;
  onApply: () => void;
  onReset: () => void;
}

export function CameraFormsListFilters({
  filters,
  isLoading,
  onSetFilters,
  onApply,
  onReset,
}: CameraFormsListFiltersProps) {
  const userStores = useAuthStore((state) => state.user?.stores ?? []);
  const authLoading = useAuthStore((state) => state.isLoading);

  const stores = useMemo(() => {
    const uniqueStores = new Map<number, string>();

    for (const assignment of userStores) {
      const storeId =
        assignment.store.internalId ?? Number.parseInt(assignment.store.id, 10);

      if (!Number.isFinite(storeId)) continue;
      if (!uniqueStores.has(storeId)) {
        uniqueStores.set(storeId, assignment.store.name);
      }
    }

    return Array.from(uniqueStores, ([id, name]) => ({ id, name }));
  }, [userStores]);

  const storesLoading = authLoading && stores.length === 0;

  const hasActiveFilters =
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.storeId !== undefined;

  const handleApply = useCallback(() => {
    onApply();
  }, [onApply]);

  const handleReset = useCallback(() => {
    onReset();
  }, [onReset]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isLoading}
            >
              <X className="me-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Store filter */}
          <div className="space-y-2">
            <Label htmlFor="store-filter">Store</Label>
            <Select
              value={filters.storeId !== undefined ? String(filters.storeId) : "all"}
              onValueChange={(val) =>
                onSetFilters({
                  storeId: val === "all" ? undefined : Number(val),
                })
              }
              disabled={storesLoading || isLoading}
            >
              <SelectTrigger id="store-filter">
                <SelectValue
                  placeholder={
                    storesLoading ? "Loading stores..." : "All stores"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={String(store.id)}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-2">
            <Label htmlFor="date-from-filter">Date From</Label>
            <Input
              id="date-from-filter"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onSetFilters({ dateFrom: e.target.value })}
              disabled={isLoading}
            />
          </div>

          {/* Date To */}
          <div className="space-y-2">
            <Label htmlFor="date-to-filter">Date To</Label>
            <Input
              id="date-to-filter"
              type="date"
              value={filters.dateTo}
              onChange={(e) => onSetFilters({ dateTo: e.target.value })}
              disabled={isLoading}
            />
          </div>

          {/* Apply button */}
          <div className="flex items-end">
            <Button
              onClick={handleApply}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <Search className="me-2 h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
