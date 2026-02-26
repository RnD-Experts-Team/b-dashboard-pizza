import { axiosClient } from "../axios-client";
import type { ApiResponse, PaginatedResponse, LaravelPaginatedResponse } from "@/types/api.types";
import type {
  AuthRule,
  GetAuthRulesParams,
  CreateAuthRulePayload,
  UpdateAuthRulePayload,
  TestAuthRulePayload,
  TestAuthRuleResult,
} from "@/types/auth-rule.types";

// Helper to transform Laravel pagination to our frontend format
function transformPaginatedResponse<T>(response: LaravelPaginatedResponse<T>): PaginatedResponse<T> {
  return {
    data: response.data.data,
    meta: {
      total: response.data.total,
      page: response.data.current_page,
      pageSize: response.data.per_page,
      totalPages: response.data.last_page,
    },
  };
}

/**
 * Normalize a snake_case auth rule from the API into our camelCase AuthRule type.
 */
function normalizeAuthRule(raw: Record<string, unknown>): AuthRule {
  return {
    id: String(raw.id ?? ""),
    service: (raw.service as string) ?? "",
    method: (raw.method as AuthRule["method"]) ?? "GET",
    pathDsl: (raw.path_dsl as string | null) ?? null,
    pathRegex: (raw.path_regex as string | null) ?? null,
    routeName: (raw.route_name as string | null) ?? null,
    rolesAny: (raw.roles_any as string[] | null) ?? null,
    permissionsAny: (raw.permissions_any as string[] | null) ?? null,
    permissionsAll: (raw.permissions_all as string[] | null) ?? null,
    isActive: (raw.is_active as boolean) ?? true,
    priority: (raw.priority as number) ?? 1,
    createdAt: (raw.created_at as string) ?? "",
    updatedAt: (raw.updated_at as string) ?? "",
    // Keep snake_case aliases for backward compat
    path_dsl: (raw.path_dsl as string | null) ?? null,
    path_regex: (raw.path_regex as string | null) ?? null,
    route_name: (raw.route_name as string | null) ?? null,
    roles_any: (raw.roles_any as string[] | null) ?? null,
    permissions_any: (raw.permissions_any as string[] | null) ?? null,
    permissions_all: (raw.permissions_all as string[] | null) ?? null,
    is_active: (raw.is_active as boolean) ?? true,
    created_at: (raw.created_at as string) ?? "",
    updated_at: (raw.updated_at as string) ?? "",
  };
}

export const authRuleService = {
  /**
   * Get paginated list of auth rules
   */
  getAuthRules: async (
    params?: GetAuthRulesParams
  ): Promise<PaginatedResponse<AuthRule>> => {
    const { data } = await axiosClient.get<LaravelPaginatedResponse<AuthRule>>(
      "/auth-rules",
      {
        params: {
          page: params?.page,
          per_page: params?.perPage,
          search: params?.search,
          service: params?.service,
        },
      }
    );
    const transformed = transformPaginatedResponse(data);
    return {
      ...transformed,
      data: transformed.data.map((item) => normalizeAuthRule(item as unknown as Record<string, unknown>)),
    };
  },

  /**
   * Get a single auth rule by ID
   */
  getAuthRule: async (id: string): Promise<ApiResponse<AuthRule>> => {
    const { data } = await axiosClient.get<{ success: boolean; message?: string; data: { rule: Record<string, unknown> } }>(
      `/auth-rules/${id}`
    );
    return {
      success: data.success,
      message: data.message,
      data: normalizeAuthRule(data.data.rule),
    };
  },

  /**
   * Create a new auth rule
   */
  createAuthRule: async (
    payload: CreateAuthRulePayload
  ): Promise<ApiResponse<AuthRule>> => {
    const requestBody: Record<string, unknown> = {
      service: payload.service,
      method: payload.method,
      path_dsl: ("pathDsl" in payload && payload.pathDsl) ? payload.pathDsl : null,
      route_name: ("routeName" in payload && payload.routeName) ? payload.routeName : null,
      roles_any: payload.rolesAny || [],
      permissions_any: payload.permissionsAny || [],
      permissions_all: payload.permissionsAll || [],
      priority: payload.priority ?? 1,
      is_active: payload.isActive ?? true,
    };

    const { data } = await axiosClient.post<{ success: boolean; message?: string; data: { rule: Record<string, unknown> } }>(
      "/auth-rules",
      requestBody
    );
    return {
      success: data.success,
      message: data.message,
      data: normalizeAuthRule(data.data.rule ?? data.data as unknown as Record<string, unknown>),
    };
  },

  /**
   * Update an existing auth rule
   */
  updateAuthRule: async (
    id: string,
    payload: UpdateAuthRulePayload
  ): Promise<ApiResponse<AuthRule>> => {
    const requestBody: Record<string, unknown> = {
      service: payload.service,
      method: payload.method,
      path_dsl: payload.pathDsl ?? null,
      route_name: payload.routeName ?? null,
      priority: payload.priority ?? 1,
      is_active: payload.isActive ?? true,
      roles_any: payload.rolesAny || [],
      permissions_any: payload.permissionsAny || [],
      permissions_all: payload.permissionsAll || [],
    };
    const { data } = await axiosClient.put<{ success: boolean; message?: string; data: { rule: Record<string, unknown> } }>(
      `/auth-rules/${id}`,
      requestBody
    );
    return {
      success: data.success,
      message: data.message,
      data: normalizeAuthRule(data.data.rule ?? data.data as unknown as Record<string, unknown>),
    };
  },

  /**
   * Delete an auth rule
   */
  deleteAuthRule: async (id: string): Promise<void> => {
    await axiosClient.delete(`/auth-rules/${id}`);
  },

  /**
   * Test an auth rule path matching
   */
  testAuthRule: async (
    payload: TestAuthRulePayload
  ): Promise<ApiResponse<TestAuthRuleResult>> => {
    const { data } = await axiosClient.post<ApiResponse<TestAuthRuleResult>>(
      "/auth-rules/test",
      {
        path_dsl: payload.pathDsl,
        test_path: payload.testPath,
      }
    );
    return data;
  },

  /**
   * Toggle active status for an auth rule
   */
  toggleAuthRuleStatus: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    const { data } = await axiosClient.post<{ success: boolean; message?: string }>(
      `/auth-rules/${id}/toggle-status`
    );
    return { success: data.success, message: data.message, data: { success: data.success } };
  },

  /**
   * Get available services for auth rules
   */
  getServices: async (): Promise<ApiResponse<string[]>> => {
    const { data } = await axiosClient.get<ApiResponse<string[]>>(
      "/auth-rules/services"
    );
    return data;
  },
};
