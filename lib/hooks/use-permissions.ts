/**
 * Permissions Hooks
 * Custom hooks for permissions feature
 */

import { useCallback, useEffect } from "react";
import { usePermissionsStore } from "@/lib/store/permissions.store";
import type { CreatePermissionPayload, UpdatePermissionPayload } from "@/types/role.types";

/**
 * Hook for fetching and managing permissions list
 */
export function usePermissions(options?: { perPage?: number }) {
  const perPage = options?.perPage;
  const {
    permissions,
    pagination,
    isLoading,
    error,
    filters,
    fetchPermissions,
    setFilters,
    clearErrors,
  } = usePermissionsStore();

  useEffect(() => {
    fetchPermissions(1, perPage);
  }, [fetchPermissions, perPage]);

  const refetch = useCallback(() => {
    fetchPermissions(pagination?.page || 1, perPage);
  }, [fetchPermissions, pagination?.page, perPage]);

  const goToPage = useCallback(
    (page: number) => {
      fetchPermissions(page, perPage);
    },
    [fetchPermissions, perPage]
  );

  const search = useCallback(
    (searchTerm: string) => {
      setFilters({ search: searchTerm });
      fetchPermissions(1, perPage);
    },
    [setFilters, fetchPermissions, perPage]
  );

  return {
    permissions,
    pagination,
    isLoading,
    error,
    filters,
    refetch,
    goToPage,
    search,
    setFilters,
    clearErrors,
  };
}

/**
 * Hook for creating permissions
 */
export function useCreatePermission() {
  const { isCreating, createError, createPermission, clearErrors } =
    usePermissionsStore();

  return {
    isCreating,
    error: createError,
    createPermission,
    clearErrors,
  };
}

/**
 * Hook for updating permissions
 */
export function useUpdatePermission() {
  const { isUpdating, updateError, updatePermission, clearErrors } =
    usePermissionsStore();

  const update = useCallback(
    async (permissionId: string, data: UpdatePermissionPayload) =>
      updatePermission(permissionId, data),
    [updatePermission]
  );

  return {
    isUpdating,
    error: updateError,
    update,
    clearErrors,
  };
}

/**
 * Hook for deleting permissions
 */
export function useDeletePermission() {
  const { isDeleting, deleteError, deletePermission, clearErrors } =
    usePermissionsStore();

  return {
    isDeleting,
    error: deleteError,
    deletePermission,
    clearErrors,
  };
}
