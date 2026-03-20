/**
 * Role & Permission Types
 * Defines all TypeScript interfaces and types for roles and permissions.
 */

// ============================================================================
// Core Entity Types
// ============================================================================

/**
 * Permission entity representing granular access rights
 */
export interface Permission {
  id: string;
  name: string;
  guardName: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Role entity representing a user role in the system
 */
export interface Role {
  id: string;
  name: string;
  guardName: string;
  description?: string;
  usersCount?: number;
  createdAt: string;
  updatedAt: string;
  permissions?: Permission[];
}

/**
 * Role with user count for management views
 */
export interface RoleWithStats extends Role {
  usersCount: number;
  permissionsCount: number;
}

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Query parameters for fetching roles
 */
export interface GetRolesParams {
  page?: number;
  perPage?: number;
  search?: string;
  guardName?: string;
}

/**
 * Query parameters for fetching permissions
 */
export interface GetPermissionsParams {
  page?: number;
  perPage?: number;
  search?: string;
  guardName?: string;
}

/**
 * Payload for creating a new role
 */
export interface CreateRolePayload {
  name: string;
  guardName?: string;
  description?: string;
  permissions?: string[];
}

/**
 * Payload for updating a role
 */
export interface UpdateRolePayload {
  name?: string;
  description?: string;
  permissions?: string[];
}

/**
 * Payload for creating a new permission
 */
export interface CreatePermissionPayload {
  name: string;
  guardName?: string;
  description?: string;
}

/**
 * Payload for updating a permission
 */
export interface UpdatePermissionPayload {
  name: string;
}

// ============================================================================
// State Types
// ============================================================================

export interface RoleAsyncStates {
  fetchRoles: { loading: boolean; error: string | null };
  fetchRole: { loading: boolean; error: string | null };
  createRole: { loading: boolean; error: string | null };
  updateRole: { loading: boolean; error: string | null };
  deleteRole: { loading: boolean; error: string | null };
  fetchPermissions: { loading: boolean; error: string | null };
}

export interface RoleFilters {
  search?: string;
  guardName?: string;
  sortField?: "name" | "createdAt" | "usersCount";
  sortDirection?: "asc" | "desc";
}
