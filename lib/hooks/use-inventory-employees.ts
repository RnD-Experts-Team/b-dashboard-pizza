"use client";

import { useCallback, useEffect, useState } from "react";
import { employeeService } from "@/lib/api/services/employee.service";
import {
  getInventoryErrorMessage,
  isCanceledError,
} from "@/lib/api/inventory-errors";
import type { MultiSelectOption } from "@/components/daily-pay/multi-select";

/**
 * Only these statuses are eligible for inventory link generation — mirrors the
 * default status filter on the main Employees page (dashboard/employees/page.tsx
 * DEFAULT_FILTERS.status_in), i.e. "currently active" employees.
 */
const ACTIVE_STATUSES = ["hired", "rehired"];

/**
 * Employee options for the create-link form, sourced from the Hiring backend's
 * global GET /v1/employees endpoint (NEXT_PUBLIC_HIRING_API_URL), the same
 * endpoint the main Employees page uses (employeeService.getEmployeesAll),
 * filtered to active statuses (hired/rehired) and scoped to one store.
 *
 * @param storeId  The store identifier (e.g. "03795-00002"). Used as the single
 *   entry in the `storeIds[]` filter. Pass null/empty to skip fetching.
 */
export function useInventoryEmployees(storeId: string | null) {
  const [options, setOptions] = useState<MultiSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!storeId) {
        setOptions([]);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const res = await employeeService.getEmployeesAll(
          [storeId],
          // The Hiring API caps per_page at 100.
          { status_in: ACTIVE_STATUSES, per_page: 100 },
          signal
        );

        const opts: MultiSelectOption[] = res.data.map((emp) => ({
          value: emp.id,
          label: [emp.first_name, emp.middle_name, emp.last_name]
            .filter(Boolean)
            .join(" "),
          hint: emp.employment_type ?? undefined,
        }));
        setOptions(opts);
      } catch (err) {
        if (isCanceledError(err)) return;
        setError(getInventoryErrorMessage(err, "Failed to load employees."));
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [storeId]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { options, isLoading, error, reload: load };
}
