import { axiosClient } from "../axios-client";
import type { ApiResponse, PaginatedResponse, LaravelPaginatedResponse } from "@/types/api.types";
import type {
  Role,
  Permission,
  RoleWithStats,
  GetRolesParams,
  GetPermissionsParams,
  CreateRolePayload,
  UpdateRolePayload,
  CreatePermissionPayload,
  UpdatePermissionPayload,
} from "@/types/role.types";

// API returns snake_case, frontend uses camelCase
interface ApiPermission {
  id: number | string;
  name: string;
  guard_name?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

interface ApiRole {
  id: number | string;
  name: string;
  guard_name?: string;
  description?: string;
  users_count?: number;
  permissions_count?: number;
  created_at?: string;
  updated_at?: string;
  permissions?: ApiPermission[];
}

// Transform API permission to frontend Permission type
function transformPermission(apiPerm: ApiPermission): Permission {
  return {
    id: String(apiPerm.id),
    name: apiPerm.name,
    guardName: apiPerm.guard_name || "web",
    description: apiPerm.description,
    createdAt: apiPerm.created_at || new Date().toISOString(),
    updatedAt: apiPerm.updated_at || new Date().toISOString(),
  };
}

// Transform API role to frontend Role type
function transformRole(apiRole: ApiRole): RoleWithStats {
  return {
    id: String(apiRole.id),
    name: apiRole.name,
    guardName: apiRole.guard_name || "web",
    description: apiRole.description,
    usersCount: apiRole.users_count || 0,
    permissionsCount: apiRole.permissions_count || apiRole.permissions?.length || 0,
    createdAt: apiRole.created_at || new Date().toISOString(),
    updatedAt: apiRole.updated_at || new Date().toISOString(),
    permissions: apiRole.permissions?.map(transformPermission),
  };
}

/**
 * Transform Laravel pagination response to simplified format
 */
function transformPaginatedResponse(
  response: LaravelPaginatedResponse<ApiRole>
): PaginatedResponse<RoleWithStats> {
  return {
    data: response.data.data.map(transformRole),
    meta: {
      total: response.data.total,
      page: response.data.current_page,
      pageSize: response.data.per_page,
      totalPages: response.data.last_page,
    },
  };
}

export const roleService = {
  /**
   * Get paginated list of roles
   */
  getRoles: async (
    params?: GetRolesParams
  ): Promise<PaginatedResponse<RoleWithStats>> => {
    const { data } = await axiosClient.get<LaravelPaginatedResponse<ApiRole>>(
      "/roles",
      {
        params: {
          page: params?.page,
          per_page: params?.perPage,
          search: params?.search,
          guard_name: params?.guardName,
        },
      }
    );
    return transformPaginatedResponse(data);
  },

  /**
   * Get a single role by ID
   */
  getRole: async (id: string): Promise<ApiResponse<Role>> => {
    const { data } = await axiosClient.get<ApiResponse<{ role: ApiRole }>>(`/roles/${id}`);
    return {
      ...data,
      data: transformRole(data.data.role),
    };
  },

  /**
   * Create a new role
   */
  createRole: async (payload: CreateRolePayload): Promise<ApiResponse<Role>> => {
    const { data } = await axiosClient.post<ApiResponse<Role>>("/roles", {
      name: payload.name,
      guard_name: payload.guardName,
      description: payload.description,
      permissions: payload.permissions,
    });
    return data;
  },

  /**
   * Update an existing role
   */
  updateRole: async (
    id: string,
    payload: UpdateRolePayload
  ): Promise<ApiResponse<Role>> => {
    const { data } = await axiosClient.put<ApiResponse<Role>>(`/roles/${id}`, {
      name: payload.name,
      description: payload.description,
      permissions: payload.permissions,
    });
    return data;
  },

  /**
   * Delete a role
   */
  deleteRole: async (id: string): Promise<void> => {
    await axiosClient.delete(`/roles/${id}`);
  },

  /**
   * Get permissions for a role
   */
  getRolePermissions: async (
    roleId: string
  ): Promise<ApiResponse<Permission[]>> => {
    const { data } = await axiosClient.get<ApiResponse<Permission[]>>(
      `/roles/${roleId}`
    );
    return data;
  },

  /**
   * Sync permissions to a role
   */
  syncRolePermissions: async (
    roleId: string,
    permissions: string[]
  ): Promise<ApiResponse<Role>> => {
    const { data } = await axiosClient.put<ApiResponse<Role>>(
      `/roles/${roleId}`,
      { permissions }
    );
    return data;
  },
};

export const permissionService = {
  /**
   * Get paginated list of permissions
   */
  getPermissions: async (
    params?: GetPermissionsParams
  ): Promise<PaginatedResponse<Permission>> => {
    const { data } = await axiosClient.get<LaravelPaginatedResponse<ApiPermission>>(
      "/permissions",
      {
        params: {
          page: params?.page,
          per_page: params?.perPage ?? 50,
          search: params?.search,
          guard_name: params?.guardName,
        },
      }
    );
    return {
      data: data.data.data.map(transformPermission),
      meta: {
        total: data.data.total,
        page: data.data.current_page,
        pageSize: data.data.per_page,
        totalPages: data.data.last_page,
      },
    };
  },

  /**
   * Get a single permission by ID
   */
  getPermission: async (id: string): Promise<ApiResponse<Permission>> => {
    const { data } = await axiosClient.get<ApiResponse<ApiPermission>>(
      `/permissions/${id}`
    );
    return {
      ...data,
      data: transformPermission(data.data),
    };
  },

  /**
   * Create a new permission
   */
  createPermission: async (
    payload: CreatePermissionPayload
  ): Promise<ApiResponse<Permission>> => {
    const { data } = await axiosClient.post<ApiResponse<ApiPermission>>(
      "/permissions",
      {
        name: payload.name,
        guard_name: payload.guardName,
        description: payload.description,
      }
    );
    return {
      ...data,
      data: transformPermission(data.data),
    };
  },

  /**
   * Update an existing permission
   */
  updatePermission: async (
    id: string,
    payload: UpdatePermissionPayload
  ): Promise<ApiResponse<Permission>> => {
    const { data } = await axiosClient.put<ApiResponse<ApiPermission>>(
      `/permissions/${id}`,
      {
        name: payload.name,
      }
    );
    return {
      ...data,
      data: transformPermission(data.data),
    };
  },

  /**
   * Delete a permission
   */
  deletePermission: async (id: string): Promise<void> => {
    await axiosClient.delete(`/permissions/${id}`);
  },
};
