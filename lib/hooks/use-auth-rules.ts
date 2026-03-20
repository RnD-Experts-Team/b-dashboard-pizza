"use client";

import { useEffect, useCallback } from "react";
import { useAuthRulesStore } from "@/lib/store/auth-rules.store";
import type { GetAuthRulesParams, AuthRuleFilters } from "@/types/auth-rule.types";

/**
 * Hook for managing auth rules list with pagination and filtering
 */
export function useAuthRules(initialParams?: GetAuthRulesParams) {
  const {
    rules,
    pagination,
    isLoading,
    error,
    filters,
    fetchRules,
    setFilters,
  } = useAuthRulesStore();

  useEffect(() => {
    fetchRules(initialParams);
  }, [fetchRules, initialParams]);

  const refetch = useCallback(
    (params?: GetAuthRulesParams) => {
      fetchRules({ ...initialParams, ...params });
    },
    [fetchRules, initialParams]
  );

  const handleSearch = useCallback(
    (search: string) => {
      setFilters({ search });
      fetchRules({ ...initialParams, search });
    },
    [fetchRules, setFilters, initialParams]
  );

  const handleServiceFilter = useCallback(
    (service: string | undefined) => {
      setFilters({ service });
      fetchRules({ ...initialParams, service });
    },
    [fetchRules, setFilters, initialParams]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      fetchRules({ ...initialParams, page });
    },
    [fetchRules, initialParams]
  );

  const handleFilterChange = useCallback(
    (newFilters: Partial<AuthRuleFilters>) => {
      setFilters(newFilters);
      fetchRules({
        ...initialParams,
        search: newFilters.search,
        service: newFilters.service,
      });
    },
    [fetchRules, setFilters, initialParams]
  );

  return {
    rules,
    pagination,
    isLoading,
    error,
    filters,
    refetch,
    handleSearch,
    handleServiceFilter,
    handlePageChange,
    handleFilterChange,
    setFilters,
  };
}

/**
 * Hook for managing a single auth rule
 */
export function useAuthRule(ruleId: string | null) {
  const {
    currentRule,
    isLoading,
    isUpdating,
    isDeleting,
    error,
    updateError,
    deleteError,
    fetchRule,
    updateRule,
    deleteRule,
    clearErrors,
  } = useAuthRulesStore();

  useEffect(() => {
    if (ruleId) {
      fetchRule(ruleId);
    }
  }, [ruleId, fetchRule]);

  const refetch = useCallback(() => {
    if (ruleId) {
      fetchRule(ruleId);
    }
  }, [ruleId, fetchRule]);

  return {
    rule: currentRule,
    isLoading,
    isUpdating,
    isDeleting,
    error,
    updateError,
    deleteError,
    refetch,
    updateRule: useCallback(
      (data: Parameters<typeof updateRule>[1]) =>
        ruleId ? updateRule(ruleId, data) : Promise.reject("No rule selected"),
      [ruleId, updateRule]
    ),
    deleteRule: useCallback(
      () => (ruleId ? deleteRule(ruleId) : Promise.reject("No rule selected")),
      [ruleId, deleteRule]
    ),
    clearErrors,
  };
}

/**
 * Hook for creating auth rules
 */
export function useCreateAuthRule() {
  const { isCreating, createError, createRule, clearErrors } =
    useAuthRulesStore();

  return {
    isCreating,
    error: createError,
    createRule,
    clearErrors,
  };
}

/**
 * Hook for updating an auth rule by ID (no auto-fetch, safe for forms)
 */
export function useUpdateAuthRule(ruleId: string | null) {
  const { isUpdating, updateError, updateRule, clearErrors } =
    useAuthRulesStore();

  return {
    isUpdating,
    updateError,
    updateRule: useCallback(
      (data: Parameters<typeof updateRule>[1]) =>
        ruleId ? updateRule(ruleId, data) : Promise.reject("No rule selected"),
      [ruleId, updateRule]
    ),
    clearErrors,
  };
}

/**
 * Hook for fetching auth rule details
 */
export function useAuthRuleDetails(ruleId: string | null | undefined) {
  const {
    currentRule,
    isLoading,
    error,
    fetchRule,
  } = useAuthRulesStore();

  const fetchAuthRuleDetails = useCallback(() => {
    if (ruleId) {
      fetchRule(ruleId);
    }
  }, [ruleId, fetchRule]);

  return {
    authRule: currentRule,
    isLoading,
    error,
    fetchAuthRule: fetchAuthRuleDetails,
  };
}

/**
 * Hook for testing auth rule path matching
 */
export function useTestAuthRule() {
  const {
    testResult,
    isTesting,
    testError,
    testRule,
    clearTestResult,
    clearErrors,
  } = useAuthRulesStore();

  return {
    testResult,
    isTesting,
    error: testError,
    testRule,
    clearTestResult,
    clearErrors,
  };
}
