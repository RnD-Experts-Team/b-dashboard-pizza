import { axiosClient } from "../axios-client";
import type { ApiResponse, PaginatedResponse, LaravelPaginatedResponse } from "@/types/api.types";
import type { User, CreateUserPayload, UpdateUserPayload } from "@/types/user.types";

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  perPage?: number;
  search?: string;
  role?: string;
  status?: string;
}

// API returns snake_case, frontend uses camelCase
interface ApiUser {
  id: number | string;
  name: string;
  email: string;
  email_verified_at?: string | null;
  created_at: string;
  updated_at: string;
  roles?: Array<{
    id: number | string;
    name: string;
    permissions?: Array<{ id: number | string; name: string }>;
  }>;
  permissions?: Array<{ id: number | string; name: string }>;
  stores?: Array<{
    store: { id: string; name: string; store_id?: string; storeId?: string };
    roles: Array<{
      id: number | string;
      name: string;
      permissions: Array<{ id: number | string; name: string }>;
    }>;
  }>;
}

// Transform API user to frontend User type
function transformUser(apiUser: ApiUser): User {
  return {
    id: String(apiUser.id),
    name: apiUser.name,
    email: apiUser.email,
    emailVerifiedAt: apiUser.email_verified_at || null,
    status: "active", // Default status - API doesn't return this
    createdAt: apiUser.created_at,
    updatedAt: apiUser.updated_at,
    roles: apiUser.roles?.map(r => ({
      id: String(r.id),
      name: r.name,
      permissions: r.permissions?.map(p => ({ id: String(p.id), name: p.name })),
    })),
    permissions: apiUser.permissions?.map(p => ({ id: String(p.id), name: p.name })),
    stores: apiUser.stores?.map(s => ({
      store: {
        id: s.store.id,
        name: s.store.name,
        storeId: s.store.store_id ?? s.store.storeId,
      },
      roles: s.roles.map(r => ({
        id: String(r.id),
        name: r.name,
        permissions: r.permissions.map(p => ({ id: String(p.id), name: p.name })),
      })),
    })),
  };
}

// Helper to transform Laravel pagination to our frontend format
function transformPaginatedResponse(response: LaravelPaginatedResponse<ApiUser>): PaginatedResponse<User> {
  return {
    data: response.data.data.map(transformUser),
    meta: {
      total: response.data.total,
      page: response.data.current_page,
      pageSize: response.data.per_page,
      totalPages: response.data.last_page,
    },
  };
}

export const userService = {
  getUsers: async (
    params?: GetUsersParams
  ): Promise<PaginatedResponse<User>> => {
    const { data } = await axiosClient.get<LaravelPaginatedResponse<ApiUser>>("/users", {
      params: {
        page: params?.page,
        per_page: params?.perPage ?? params?.pageSize,
        search: params?.search,
        role: params?.role,
        status: params?.status,
      },
    });
    return transformPaginatedResponse(data);
  },

  getUser: async (id: string): Promise<ApiResponse<User>> => {
    const { data } = await axiosClient.get<ApiResponse<{ user: ApiUser }>>(`/users/${id}`);
    // console.log("Fetched user data from API:", data);
    return {
      ...data,
      data: transformUser(data.data.user),
    };
  },

  createUser: async (userData: CreateUserPayload): Promise<ApiResponse<User>> => {
    const payload = {
      name: userData.name,
      email: userData.email,
      password: userData.password,
      password_confirmation: userData.passwordConfirmation || userData.password,
      roles: userData.roles,
      permissions: userData.permissions,
    };
    const { data } = await axiosClient.post<ApiResponse<ApiUser>>("/users", payload);
    return {
      ...data,
      data: transformUser(data.data),
    };
  },

  updateUser: async (
    id: string,
    userData: UpdateUserPayload
  ): Promise<ApiResponse<User>> => {
    const payload: Record<string, unknown> = {};
    if (userData.name) payload.name = userData.name;
    if (userData.email) payload.email = userData.email;
    if (userData.password) {
      payload.password = userData.password;
      payload.password_confirmation = userData.passwordConfirmation || userData.password;
    }
    if (userData.roles) payload.roles = userData.roles;
    if (userData.permissions) payload.permissions = userData.permissions;
    
    const { data } = await axiosClient.put<ApiResponse<ApiUser>>(
      `/users/${id}`,
      payload
    );
    return {
      ...data,
      data: transformUser(data.data),
    };
  },

  deleteUser: async (id: string): Promise<void> => {
    await axiosClient.delete(`/users/${id}`);
  },

  assignRoles: async (userId: string, roles: string[]): Promise<ApiResponse<User>> => {
    const { data } = await axiosClient.post<ApiResponse<ApiUser>>(
      `/users/${userId}/roles`,
      { roles }
    );
    return {
      ...data,
      data: transformUser(data.data),
    };
  },

  assignPermissions: async (userId: string, permissions: string[]): Promise<ApiResponse<User>> => {
    const { data } = await axiosClient.post<ApiResponse<ApiUser>>(
      `/users/${userId}/permissions`,
      { permissions }
    );
    return {
      ...data,
      data: transformUser(data.data),
    };
  },
};
