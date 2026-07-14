import { axiosClient } from "../axios-client";
import type { ApiResponse } from "@/types/api.types";
import type { AuthRule } from "@/types/auth-rule.types";
import type {
  LoginCredentials,
  AuthUser,
  ApiLoginResponse,
  ApiMeResponse,
  ApiAuthUser,
  ApiAuthRole,
  ApiAuthPermission,
  ApiAuthUserStore,
} from "@/types/auth.types";

type RawAuthRule = Record<string, unknown>;

function transformAuthRule(raw: RawAuthRule): AuthRule {
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
    storeScopeMode: (raw.store_scope_mode as string | null) ?? null,
    storeIdSources: (raw.store_id_sources as string[] | null) ?? null,
    storeMatchPolicy: (raw.store_match_policy as string | null) ?? null,
    storeAllowsEmpty: (raw.store_allows_empty as boolean) ?? false,
    storeAllAccessRolesAny: (raw.store_all_access_roles_any as string[] | null) ?? null,
    storeAllAccessPermissionsAny: (raw.store_all_access_permissions_any as string[] | null) ?? null,
    createdAt: (raw.created_at as string) ?? "",
    updatedAt: (raw.updated_at as string) ?? "",
    // snake_case aliases for canAccess engine
    path_dsl: (raw.path_dsl as string | null) ?? null,
    path_regex: (raw.path_regex as string | null) ?? null,
    route_name: (raw.route_name as string | null) ?? null,
    roles_any: (raw.roles_any as string[] | null) ?? null,
    permissions_any: (raw.permissions_any as string[] | null) ?? null,
    permissions_all: (raw.permissions_all as string[] | null) ?? null,
    store_scope_mode: (raw.store_scope_mode as string | null) ?? null,
    store_id_sources: (raw.store_id_sources as string[] | null) ?? null,
    store_match_policy: (raw.store_match_policy as string | null) ?? null,
    store_allows_empty: (raw.store_allows_empty as boolean) ?? false,
    store_all_access_roles_any: (raw.store_all_access_roles_any as string[] | null) ?? null,
    store_all_access_permissions_any: (raw.store_all_access_permissions_any as string[] | null) ?? null,
    is_active: (raw.is_active as boolean) ?? true,
    created_at: (raw.created_at as string) ?? "",
    updated_at: (raw.updated_at as string) ?? "",
  };
}

/** Lightweight store info derived from the general-overview response. */
export interface OverviewStore {
  /** Numeric store id string (e.g. "48") — used as the storePermissions map key. */
  id: string;
  /** Human-readable store identifier (e.g. "03795-00001"), cross-referenced from /auth/me. */
  storeId?: string;
  name: string;
  metadata: Record<string, unknown>;
  isActive: boolean;
}

export interface GeneralOverviewResult {
  authRules: AuthRule[];
  globalPermissions: Set<string>;
  storePermissions: Record<string, Set<string>>;
  /** Basic user info returned by the overview endpoint */
  overviewUser: { id: string; name: string; email: string } | null;
  /** Store assignments the user has access to, keyed by numeric store id */
  overviewStores: OverviewStore[];
}

/**
 * Transform API permission to frontend format
 */
function transformPermission(apiPerm: ApiAuthPermission) {
  return {
    id: String(apiPerm.id),
    name: apiPerm.name,
    guardName: apiPerm.guard_name,
  };
}

/**
 * Transform API role to frontend format
 */
function transformRole(apiRole: ApiAuthRole) {
  return {
    id: String(apiRole.id),
    name: apiRole.name,
    guardName: apiRole.guard_name,
    permissions: apiRole.permissions?.map(transformPermission),
  };
}

/**
 * Transform API user store to frontend format
 */
function transformUserStore(apiStore: ApiAuthUserStore) {
  return {
    store: {
      id: apiStore.store.store_id,
      internalId: apiStore.store.id,
      name: apiStore.store.name,
      metadata: apiStore.store.metadata,
      isActive: apiStore.store.is_active,
    },
    directRoles: apiStore.direct_roles?.map(transformRole) || [],
    effectiveRoles: apiStore.effective_roles?.map(r => ({
      ...transformRole(r),
      isInherited: r.is_inherited,
    })) || [],
    effectivePermissions: apiStore.effective_permissions?.map(transformPermission) || [],
    hierarchyInfo: apiStore.hierarchy_info?.map(h => ({
      role: { id: String(h.role.id), name: h.role.name },
      managesRoles: h.manages_roles?.map(r => ({ id: String(r.id), name: r.name })) || [],
      managedByRoles: h.managed_by_roles?.map(r => ({ id: String(r.id), name: r.name })) || [],
      canManageUsers: h.can_manage_users,
      hierarchyLevel: h.hierarchy_level,
    })),
    manageableUsers: apiStore.manageable_users,
    assignmentMetadata: apiStore.assignment_metadata?.map(m => ({
      roleId: String(m.role_id),
      roleName: m.role_name,
      metadata: m.metadata,
      assignedAt: m.assigned_at,
      isActive: m.is_active,
    })),
  };
}

/**
 * Transform API user to frontend AuthUser format
 */
function transformUser(apiUser: ApiAuthUser): AuthUser {
  return {
    id: String(apiUser.id),
    name: apiUser.name,
    email: apiUser.email,
    avatar: apiUser.image_url ?? apiUser.image_path ?? null,
    emailVerifiedAt: apiUser.email_verified_at,
    createdAt: apiUser.created_at,
    updatedAt: apiUser.updated_at,
    globalRoles: apiUser.global_roles?.map(transformRole) || [],
    globalPermissions: apiUser.global_permissions?.map(transformPermission) || [],
    allPermissions: apiUser.all_permissions?.map(transformPermission) || [],
    stores: apiUser.stores?.map(transformUserStore) || [],
    summary: {
      totalStores: apiUser.summary?.total_stores || 0,
      totalRoles: apiUser.summary?.total_roles || 0,
      totalPermissions: apiUser.summary?.total_permissions || 0,
      manageableUsersCount: apiUser.summary?.manageable_users_count || 0,
    },
  };
}

export const authService = {
  login: async (
    credentials: LoginCredentials
  ): Promise<{ success: boolean; message?: string; data: { user: AuthUser; token: string } }> => {
    const { data } = await axiosClient.post<ApiLoginResponse>(
      "/auth/login",
      credentials
    );
    
    return {
      success: data.success,
      message: data.message,
      data: {
        user: transformUser(data.data.user),
        token: data.data.token,
      },
    };
  },

  logout: async (): Promise<void> => {
    try {
      await axiosClient.post("/auth/logout");
    } catch {
      // Ignore logout errors - we'll clear local state anyway
    }
  },

  me: async (): Promise<ApiResponse<AuthUser>> => {
    const { data } = await axiosClient.get<ApiMeResponse>("/auth/me");
    
    return {
      success: data.success,
      message: data.message,
      data: transformUser(data.data.user),
    };
  },

  /**
   * Fetch auth rules + flattened permission data from /auth/general-overview.
   * Must only be called AFTER the user has authenticated (token must be valid).
   * When called during login, pass the fresh token explicitly so the axios
   * interceptor does not have to find it in localStorage yet.
   */
  getGeneralOverview: async (token?: string): Promise<ApiResponse<GeneralOverviewResult>> => {
    const { data } = await axiosClient.get<{
      success: boolean;
      message?: string;
      data: {
        user?: { id: number; name: string; email: string };
        auth_rules?: RawAuthRule[];
        full_permissions?: Array<{ id: number; name: string }>;
        direct_permissions?: Array<{ id: number; name: string }>;
        direct_roles?: Array<{ permissions?: Array<{ id: number; name: string }> }>;
        store_assignments?: Array<{
          store: { id: number | string; name: string; metadata?: Record<string, unknown>; is_active?: boolean };
          all_permissions_from_store_roles?: Array<{ id: number; name: string }>;
        }>;
      };
    }>("/auth/general-overview", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    // ── User info ──────────────────────────────────────────────────────────
    const overviewUser = data.data.user
      ? { id: String(data.data.user.id), name: data.data.user.name, email: data.data.user.email }
      : null;

    // ── Global permissions ─────────────────────────────────────────────────
    // Merge full_permissions + direct_permissions + permissions from
    // direct_roles into one flat set.
    const globalPermissions = new Set<string>();
    data.data.full_permissions?.forEach((p) => globalPermissions.add(p.name));
    data.data.direct_permissions?.forEach((p) => globalPermissions.add(p.name));
    data.data.direct_roles?.forEach((role) =>
      role.permissions?.forEach((p) => globalPermissions.add(p.name))
    );

    // ── Store-scoped permissions ───────────────────────────────────────────
    // Keyed by the store's numeric id (as string) — this is the only id
    // present in the general-overview response.
    const storePermissions: Record<string, Set<string>> = {};
    const overviewStores: OverviewStore[] = [];

    data.data.store_assignments?.forEach((assignment) => {
      const id = String(assignment.store.id);
      const perms = new Set<string>();
      assignment.all_permissions_from_store_roles?.forEach((p) => perms.add(p.name));
      storePermissions[id] = perms;

      overviewStores.push({
        id,
        name: assignment.store.name,
        metadata: assignment.store.metadata ?? {},
        isActive: assignment.store.is_active ?? true,
      });
    });

    return {
      success: data.success,
      message: data.message,
      data: {
        authRules: (data.data.auth_rules ?? []).map(transformAuthRule),
        globalPermissions,
        storePermissions,
        overviewUser,
        overviewStores,
      },
    };
  },

  refreshToken: async (): Promise<ApiResponse<{ token: string }>> => {
    const { data } = await axiosClient.post<ApiResponse<{ token: string }>>(
      "/auth/refresh-token"
    );
    return data;
  },

  /**
   * Start impersonating another user. The upstream response envelope is
   * unconfirmed until tested against the real backend, so both a nested
   * `data.token` (matches login/getGeneralOverview) and a flat `token`
   * are handled here.
   */
  impersonate: async (userId: string): Promise<{ token: string }> => {
    const { data } = await axiosClient.post<{
      success?: boolean;
      message?: string;
      data?: { token?: string };
      token?: string;
    }>(`/auth/impersonate/${userId}`);

    const token = data?.data?.token ?? data?.token;
    if (!token) {
      throw new Error("Impersonation response did not include a token.");
    }
    return { token };
  },

  updateMe: async (payload: {
    name: string;
    email: string;
    image?: File | null;
    password?: string;
    password_confirmation?: string;
    remove_image?: boolean;
  }): Promise<ApiResponse<AuthUser>> => {
    const form = new FormData();
    form.append("name", payload.name);
    form.append("email", payload.email);
    if (payload.image) {
      form.append("image", payload.image);
    }
    if (payload.password) {
      form.append("password", payload.password);
      form.append("password_confirmation", payload.password_confirmation ?? "");
    }
    if (payload.remove_image) {
      form.append("remove_image", "1");
    }

    const { data } = await axiosClient.post<ApiMeResponse>("/auth/me", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return {
      success: data.success,
      message: data.message,
      data: transformUser(data.data.user),
    };
  },
};
