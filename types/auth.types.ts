import type { User, UserStore, UserSummary, UserRole, UserPermission } from "./user.types";
import type { Role, Permission } from "./role.types";

export type { User };

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  token_type: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * User data returned from login and /me endpoints
 * This is the full user object with all permissions and roles
 */
export interface AuthUser {
  id: string | number;
  name: string;
  email: string;
  avatar?: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Global roles assigned directly to user
  globalRoles: AuthRole[];
  // Global permissions assigned directly to user
  globalPermissions: AuthPermission[];
  // ALL permissions (from global roles + direct permissions + store roles)
  allPermissions: AuthPermission[];
  // Stores user has access to with their roles
  stores: AuthUserStore[];
  // Summary statistics
  summary: AuthUserSummary;
}

export interface AuthRole {
  id: string | number;
  name: string;
  guardName: string;
  permissions?: AuthPermission[];
}

export interface AuthPermission {
  id: string | number;
  name: string;
  guardName: string;
}

export interface AuthUserStore {
  store: {
    id: string;
    internalId?: number;
    name: string;
    metadata?: Record<string, unknown>;
    isActive?: boolean;
  };
  directRoles: AuthRole[];
  effectiveRoles: (AuthRole & { isInherited: boolean })[];
  effectivePermissions: AuthPermission[];
  hierarchyInfo?: AuthHierarchyInfo[];
  manageableUsers?: string[];
  assignmentMetadata?: AuthAssignmentMetadata[];
}

export interface AuthHierarchyInfo {
  role: { id: string | number; name: string };
  managesRoles: { id: string | number; name: string }[];
  managedByRoles: { id: string | number; name: string }[];
  canManageUsers: boolean;
  hierarchyLevel: number;
}

export interface AuthAssignmentMetadata {
  roleId: string | number;
  roleName: string;
  metadata?: Record<string, unknown>;
  assignedAt: string;
  isActive: boolean;
}

export interface AuthUserSummary {
  totalStores: number;
  totalRoles: number;
  totalPermissions: number;
  manageableUsersCount: number;
}

/**
 * API response types (snake_case from Laravel)
 */
export interface ApiAuthUser {
  id: number;
  name: string;
  email: string;
  image_path?: string | null;
  image_url?: string | null;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  global_roles: ApiAuthRole[];
  global_permissions: ApiAuthPermission[];
  all_permissions: ApiAuthPermission[];
  stores: ApiAuthUserStore[];
  summary: ApiAuthUserSummary;
}

export interface ApiAuthRole {
  id: number;
  name: string;
  guard_name: string;
  permissions?: ApiAuthPermission[];
}

export interface ApiAuthPermission {
  id: number;
  name: string;
  guard_name: string;
}

export interface ApiAuthUserStore {
  store: {
    id: number;
    store_id: string;
    name: string;
    metadata?: Record<string, unknown>;
    is_active?: boolean;
  };
  direct_roles: ApiAuthRole[];
  effective_roles: (ApiAuthRole & { is_inherited: boolean })[];
  effective_permissions: ApiAuthPermission[];
  hierarchy_info?: ApiAuthHierarchyInfo[];
  manageable_users?: string[];
  assignment_metadata?: ApiAuthAssignmentMetadata[];
}

export interface ApiAuthHierarchyInfo {
  role: { id: number; name: string };
  manages_roles: { id: number; name: string }[];
  managed_by_roles: { id: number; name: string }[];
  can_manage_users: boolean;
  hierarchy_level: number;
}

export interface ApiAuthAssignmentMetadata {
  role_id: number;
  role_name: string;
  metadata?: Record<string, unknown>;
  assigned_at: string;
  is_active: boolean;
}

export interface ApiAuthUserSummary {
  total_stores: number;
  total_roles: number;
  total_permissions: number;
  manageable_users_count: number;
}

export interface ApiLoginResponse {
  success: boolean;
  message: string;
  data: {
    user: ApiAuthUser;
    token: string;
    token_type: string;
  };
}

export interface ApiMeResponse {
  success: boolean;
  message?: string;
  data: {
    user: ApiAuthUser;
  };
}
