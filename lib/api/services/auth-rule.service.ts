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
  const pathDsl = (raw.path_dsl as string | null) ?? (raw.pathDsl as string | null) ?? null;
  const pathRegex = (raw.path_regex as string | null) ?? (raw.pathRegex as string | null) ?? null;
  const routeName = (raw.route_name as string | null) ?? (raw.routeName as string | null) ?? null;
  const rolesAny = (raw.roles_any as string[] | null) ?? (raw.rolesAny as string[] | null) ?? null;
  const permissionsAny =
    (raw.permissions_any as string[] | null) ?? (raw.permissionsAny as string[] | null) ?? null;
  const permissionsAll =
    (raw.permissions_all as string[] | null) ?? (raw.permissionsAll as string[] | null) ?? null;
  const isActive = (raw.is_active as boolean | undefined) ?? (raw.isActive as boolean | undefined) ?? true;
  const createdAt = (raw.created_at as string) ?? (raw.createdAt as string) ?? "";
  const updatedAt = (raw.updated_at as string) ?? (raw.updatedAt as string) ?? "";

  const storeScopeMode =
    (raw.store_scope_mode as string | null) ?? (raw.storeScopeMode as string | null) ?? null;
  const storeIdSources =
    (raw.store_id_sources as string[] | null) ?? (raw.storeIdSources as string[] | null) ?? null;
  const storeMatchPolicy =
    (raw.store_match_policy as string | null) ?? (raw.storeMatchPolicy as string | null) ?? null;
  const storeAllowsEmpty =
    (raw.store_allows_empty as boolean | undefined) ??
    (raw.storeAllowsEmpty as boolean | undefined) ??
    false;
  const storeAllAccessRolesAny =
    (raw.store_all_access_roles_any as string[] | null) ??
    (raw.storeAllAccessRolesAny as string[] | null) ??
    null;
  const storeAllAccessPermissionsAny =
    (raw.store_all_access_permissions_any as string[] | null) ??
    (raw.storeAllAccessPermissionsAny as string[] | null) ??
    null;

  return {
    id: String(raw.id ?? ""),
    service: (raw.service as string) ?? "",
    method: ((raw.method as AuthRule["method"]) ?? (raw.httpMethod as AuthRule["method"])) ?? "GET",
    pathDsl,
    pathRegex,
    routeName,
    rolesAny,
    permissionsAny,
    permissionsAll,
    isActive,
    priority: (raw.priority as number) ?? 1,
    storeScopeMode,
    storeIdSources,
    storeMatchPolicy,
    storeAllowsEmpty,
    storeAllAccessRolesAny,
    storeAllAccessPermissionsAny,
    createdAt,
    updatedAt,
    // Keep snake_case aliases for backward compat
    path_dsl: pathDsl,
    path_regex: pathRegex,
    route_name: routeName,
    roles_any: rolesAny,
    permissions_any: permissionsAny,
    permissions_all: permissionsAll,
    store_scope_mode: storeScopeMode,
    store_id_sources: storeIdSources,
    store_match_policy: storeMatchPolicy,
    store_allows_empty: storeAllowsEmpty,
    store_all_access_roles_any: storeAllAccessRolesAny,
    store_all_access_permissions_any: storeAllAccessPermissionsAny,
    is_active: isActive,
    created_at: createdAt,
    updated_at: updatedAt,
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
  getAuthRule: async (id: string, signal?: AbortSignal): Promise<ApiResponse<AuthRule>> => {
    const { data } = await axiosClient.get<{
      success?: boolean;
      message?: string;
      data?: Record<string, unknown>;
      rule?: Record<string, unknown>;
    }>(`/auth-rules/${id}`, {
      signal,
    });

    const nestedData =
      data.data && typeof data.data === "object" ? data.data : undefined;
    const nestedDataInner =
      nestedData?.["data"] && typeof nestedData["data"] === "object"
        ? (nestedData["data"] as Record<string, unknown>)
        : undefined;

    const nestedRule =
      (nestedData?.["rule"] as Record<string, unknown> | undefined) ??
      (nestedData?.["auth_rule"] as Record<string, unknown> | undefined) ??
      (nestedDataInner?.["rule"] as Record<string, unknown> | undefined) ??
      (nestedDataInner?.["auth_rule"] as Record<string, unknown> | undefined);

    const rawRule =
      nestedRule ??
      nestedDataInner ??
      nestedData ??
      (data.rule && typeof data.rule === "object" ? data.rule : undefined) ??
      {};

    return {
      success: data.success ?? true,
      message: data.message,
      data: normalizeAuthRule(rawRule),
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
      store_scope_mode: payload.storeScopeMode ?? "none",
      store_id_sources: payload.storeIdSources ?? [],
      store_match_policy: payload.storeMatchPolicy ?? "all",
      store_allows_empty: payload.storeAllowsEmpty ?? false,
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
      store_scope_mode: payload.storeScopeMode ?? "none",
      store_id_sources: payload.storeIdSources ?? [],
      store_match_policy: payload.storeMatchPolicy ?? "all",
      store_allows_empty: payload.storeAllowsEmpty ?? false,
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
