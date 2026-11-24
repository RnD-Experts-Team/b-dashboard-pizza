"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useRolesStore } from "@/lib/store/roles.store";
import type {
  GetRolesParams,
  GetPermissionsParams,
  RoleFilters,
} from "@/types/role.types";

/**
 * Hook for managing roles list with pagination and filtering
 */
export function useRoles(initialParams?: GetRolesParams) {
  const {
    roles,
    rolesPagination,
    isLoading,
    error,
    filters,
    fetchRoles,
    setFilters,
  } = useRolesStore();

  useEffect(() => {
    fetchRoles(initialParams);
  }, [fetchRoles, initialParams]);

  const refetch = useCallback(
    (params?: GetRolesParams) => {
      fetchRoles({ ...initialParams, ...params });
    },
    [fetchRoles, initialParams]
  );

  const handleSearch = useCallback(
    (search: string) => {
      setFilters({ search });
      fetchRoles({ ...initialParams, search });
    },
    [fetchRoles, setFilters, initialParams]
  );

  // Keep the current search while paging, otherwise page 2 of a search
  // would show page 2 of the unfiltered list.
  const handlePageChange = useCallback(
    (page: number) => {
      fetchRoles({ ...initialParams, search: filters.search || undefined, page });
    },
    [fetchRoles, initialParams, filters.search]
  );

  return {
    roles,
    pagination: rolesPagination,
    isLoading,
    error,
    filters,
    refetch,
    handleSearch,
    handlePageChange,
    setFilters,
  };
}

/**
 * Hook for managing a single role with permissions
 */
export function useRole(roleId: string | null) {
  const {
    currentRole,
    currentRolePermissions,
    isLoading,
    isLoadingPermissions,
    isUpdating,
    isDeleting,
    error,
    permissionsError,
    updateError,
    deleteError,
    fetchRole,
    fetchRolePermissions,
    updateRole,
    deleteRole,
    syncRolePermissions,
    clearErrors,
  } = useRolesStore();

  useEffect(() => {
    if (roleId) {
      fetchRole(roleId);
      fetchRolePermissions(roleId);
    }
  }, [roleId, fetchRole, fetchRolePermissions]);

  const refetch = useCallback(() => {
    if (roleId) {
      fetchRole(roleId);
      fetchRolePermissions(roleId);
    }
  }, [roleId, fetchRole, fetchRolePermissions]);

  return {
    role: currentRole,
    permissions: currentRolePermissions,
    isLoading,
    isLoadingPermissions,
    isUpdating,
    isDeleting,
    error,
    permissionsError,
    updateError,
    deleteError,
    refetch,
    updateRole: useCallback(
      (data: Parameters<typeof updateRole>[1]) =>
        roleId ? updateRole(roleId, data) : Promise.reject("No role selected"),
      [roleId, updateRole]
    ),
    deleteRole: useCallback(
      () => (roleId ? deleteRole(roleId) : Promise.reject("No role selected")),
      [roleId, deleteRole]
    ),
    syncPermissions: useCallback(
      (permissions: string[]) =>
        roleId
          ? syncRolePermissions(roleId, permissions)
          : Promise.reject("No role selected"),
      [roleId, syncRolePermissions]
    ),
    clearErrors,
  };
}

/**
 * Hook for creating roles
 */
export function useCreateRole() {
  const { isCreating, createError, createRole, clearErrors } = useRolesStore();

  return {
    isCreating,
    error: createError,
    createRole,
    clearErrors,
  };
}

/**
 * Hook for fetching role details
 */
export function useRoleDetails(roleId: string) {
  const {
    currentRole,
    isLoading,
    error,
    fetchRole,
  } = useRolesStore();

  const fetchRoleDetails = useCallback(() => {
    if (roleId) {
      fetchRole(roleId);
    }
  }, [roleId, fetchRole]);

  return {
    role: currentRole,
    isLoading,
    error,
    fetchRole: fetchRoleDetails,
  };
}

/**
 * Hook for updating roles
 */
export function useUpdateRole() {
  const { isUpdating, updateError, updateRole, syncRolePermissions, clearErrors } = useRolesStore();

  return {
    isUpdating,
    error: updateError,
    updateRole,
    syncPermissions: syncRolePermissions,
    clearErrors,
  };
}

/**
 * Hook for deleting roles
 */
export function useDeleteRole() {
  const { isDeleting, deleteError, deleteRole, clearErrors } = useRolesStore();

  return {
    isDeleting,
    error: deleteError,
    deleteRole,
    clearErrors,
  };
}

/**
 * Hook for managing permissions list
 */
export function usePermissions(initialParams?: GetPermissionsParams) {
  const {
    permissions,
    permissionsPagination,
    isLoadingPermissions,
    permissionsError,
    fetchPermissions,
    createPermission,
    updatePermission,
    deletePermission,
  } = useRolesStore();

  useEffect(() => {
    fetchPermissions(initialParams);
  }, [fetchPermissions, initialParams]);

  const refetch = useCallback(
    (params?: GetPermissionsParams) => {
      fetchPermissions({ ...initialParams, ...params });
    },
    [fetchPermissions, initialParams]
  );

  const handleSearch = useCallback(
    (search: string) => {
      fetchPermissions({ ...initialParams, search });
    },
    [fetchPermissions, initialParams]
  );

  return {
    permissions,
    pagination: permissionsPagination,
    isLoading: isLoadingPermissions,
    error: permissionsError,
    refetch,
    handleSearch,
    createPermission,
    updatePermission,
    deletePermission,
  };
}

/**
 * Hook for selecting roles (e.g., in forms)
 */
export function useRoleSelection() {
  const { roles, isLoading, fetchRoles } = useRolesStore();

  useEffect(() => {
    if (roles.length === 0) {
      fetchRoles({ perPage: 100 });
    }
  }, [roles.length, fetchRoles]);

  const roleOptions = useMemo(
    () =>
      roles.map((role) => ({
        value: role.id,
        label: role.name,
        description: role.description,
      })),
    [roles]
  );

  return {
    roles,
    roleOptions,
    isLoading,
    refetch: () => fetchRoles({ perPage: 100 }),
  };
}

/**
 * Hook for selecting permissions (e.g., in forms)
 */
export function usePermissionSelection() {
  const { permissions, isLoadingPermissions, fetchPermissions } = useRolesStore();

  useEffect(() => {
    if (permissions.length === 0) {
      fetchPermissions({ perPage: 200 });
    }
  }, [permissions.length, fetchPermissions]);

  const permissionOptions = useMemo(
    () =>
      permissions.map((permission) => ({
        value: permission.id,
        label: permission.name,
        description: permission.description,
      })),
    [permissions]
  );

  // Group permissions by category (assuming format: category.action)
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, typeof permissionOptions> = {};
    permissionOptions.forEach((perm) => {
      const [category] = perm.label.split(".");
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(perm);
    });
    return groups;
  }, [permissionOptions]);

  return {
    permissions,
    permissionOptions,
    groupedPermissions,
    isLoading: isLoadingPermissions,
    refetch: () => fetchPermissions({ perPage: 200 }),
  };
}
