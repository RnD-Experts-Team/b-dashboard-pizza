import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** SSR-safe no-op storage — avoids Node.js `--localstorage-file` warning */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
import type { AxiosError } from "axios";
import { authService } from "@/lib/api/services/auth.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useDsprStore } from "@/lib/store/dspr.store";
import type { OverviewStore } from "@/lib/api/services/auth.service";
import type { AuthUser, LoginCredentials, AuthUserStore } from "@/types/auth.types";
import type { AuthRule } from "@/types/auth-rule.types";
import {
  canAccess as canAccessFn,
  normalizeAuthPermissions,
  type CanAccessParams,
} from "./can-access";

interface AuthState {
  // User data
  user: AuthUser | null;
  token: string | null;
  
  // Derived permission/role arrays for quick lookup
  permissions: string[];
  roles: string[];

  // ── Rule-based authorization state ──────────────────────────────────────
  /** Flat set of global permission names (from global_roles[].permissions[]) */
  globalPermissions: Set<string>;
  /** Per-store permission sets (from stores[].effective_permissions[]) */
  storePermissions: Record<string, Set<string>>;
  /**
   * Auth rules used by canAccessRoute().
   * Loaded from GET /auth/general-overview after authentication.
   */
  authRules: AuthRule[];
  /**
   * Store list from /auth/general-overview.
   * Uses numeric store IDs (as strings) consistent with storePermissions keys.
   */
  overviewStores: OverviewStore[];
  // ────────────────────────────────────────────────────────────────────────
  
  // Auth status
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  /**
   * Merge a partial set of basic profile fields (name, email, avatar) into
   * the current user WITHOUT touching permissions, roles, authRules, or
   * overviewStores. Use this after a profile-update API call whose response
   * does not contain the full permission payload.
   */
  patchUser: (fields: Partial<Pick<AuthUser, 'name' | 'email' | 'avatar'>>) => void;
  setToken: (token: string) => void;
  checkAuth: () => Promise<void>;
  initialize: () => void;
  
  // Permission helpers (legacy — checks flat `permissions` array)
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAllRoles: (roles: string[]) => boolean;
  isSuperAdmin: () => boolean;
  canAccess: (requiredPermissions?: string[], requiredRoles?: string[]) => boolean;

  /**
   * Rule-based authorization check using auth rules + normalized permissions.
   * Use this for dynamic UI rendering decisions.
   */
  canAccessRoute: (params: CanAccessParams) => boolean;
  
  // Store helpers
  getUserStores: () => AuthUserStore[];
  hasStoreAccess: (storeId: string) => boolean;
  getStorePermissions: (storeId: string) => string[];
  getStoreRoles: (storeId: string) => string[];
}

/**
 * Extract all permission names from AuthUser
 */
function extractPermissions(user: AuthUser | null): string[] {
  if (!user) return [];
  return user.allPermissions?.map(p => p.name) || [];
}

/**
 * Extract all role names from AuthUser (global + store roles)
 */
function extractRoles(user: AuthUser | null): string[] {
  if (!user) return [];
  
  const roleNames = new Set<string>();
  
  // Add global roles
  user.globalRoles?.forEach(r => roleNames.add(r.name));
  
  // Add store-specific roles
  user.stores?.forEach(store => {
    store.effectiveRoles?.forEach(r => roleNames.add(r.name));
  });
  
  return Array.from(roleNames);
}

function getLoginErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string; error?: string }>;
  const responseMessage = axiosError?.response?.data?.message;
  const responseError = axiosError?.response?.data?.error;

  if (responseMessage) return responseMessage;
  if (responseError) return responseError;
  if (axiosError?.code === "ECONNABORTED") {
    return "Login request timed out. Please try again.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Login failed. Please check your credentials and try again.";
}

function persistUserData(user: AuthUser | null) {
  if (typeof window === "undefined") return;

  if (!user) {
    localStorage.removeItem("auth-user");
    return;
  }

  localStorage.setItem("auth-user", JSON.stringify(user));
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      permissions: [],
      roles: [],
      globalPermissions: new Set<string>(),
      storePermissions: {},
      authRules: [],
      overviewStores: [],
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true });
        try {
          const response = await authService.login(credentials);
          if (response.success) {
            const user = response.data.user;
            // Fetch rules + permissions from general-overview using the fresh
            // token so the axios interceptor does not need localStorage yet.
            const overview = await authService.getGeneralOverview(response.data.token);
            const { globalPermissions, storePermissions, authRules, overviewStores } =
              overview.success
                ? overview.data
                : { ...normalizeAuthPermissions(user as unknown as Parameters<typeof normalizeAuthPermissions>[0]), authRules: [], overviewStores: [] };
            // Cross-reference user.stores (from login response) to attach human-readable storeId
            const loginIdMap = new Map<string, string>();
            user.stores?.forEach((s) => {
              if (s.store.internalId !== undefined) {
                loginIdMap.set(String(s.store.internalId), s.store.id);
              }
            });
            const enrichedLoginStores = overviewStores.map((s) => ({
              ...s,
              storeId: loginIdMap.get(s.id) ?? s.id,
            }));
            set({
              user,
              token: response.data.token,
              permissions: extractPermissions(user),
              roles: extractRoles(user),
              globalPermissions,
              storePermissions,
              authRules,
              overviewStores: enrichedLoginStores,
              isAuthenticated: true,
              isLoading: false,
            });
            persistUserData(user);
          } else {
            set({ isLoading: false });
            throw new Error(response.message || "Login failed");
          }
        } catch (error) {
          set({ isLoading: false });
          throw new Error(getLoginErrorMessage(error));
        }
      },

      logout: () => {
        authService.logout().catch(() => {});
        try {
          useDsprStore.getState().reset();
          useSelectedStoreStore.getState().clearSelectedStore();
          useSelectedStoreStore.persist.clearStorage();
        } catch {
          // ignore client-side cache cleanup failures during logout
        }
        set({
          user: null,
          token: null,
          permissions: [],
          roles: [],
          globalPermissions: new Set<string>(),
          storePermissions: {},
          authRules: [],
          overviewStores: [],
          isAuthenticated: false,
        });
        persistUserData(null);
      },

      setUser: (user: AuthUser) => {
        const { globalPermissions, storePermissions } =
          normalizeAuthPermissions(user as unknown as Parameters<typeof normalizeAuthPermissions>[0]);
        set({
          user,
          permissions: extractPermissions(user),
          roles: extractRoles(user),
          globalPermissions,
          storePermissions,
        });
        persistUserData(user);
      },

      patchUser: (fields) => {
        const current = get().user;
        if (!current) return;
        const updated = { ...current, ...fields };
        set({ user: updated });
        persistUserData(updated);
      },

      setToken: (token: string) => {
        set({ token, isAuthenticated: true });
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({
            isAuthenticated: false,
            user: null,
            permissions: [],
            roles: [],
            globalPermissions: new Set<string>(),
            storePermissions: {},
            overviewStores: [],
          });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await authService.me();
          if (response.success) {
            const user = response.data;
            // Re-fetch rules + permissions; token is already in localStorage
            // so the axios interceptor will attach it automatically.
            const overview = await authService.getGeneralOverview(token);
            const { globalPermissions, storePermissions, authRules, overviewStores } =
              overview.success
                ? overview.data
                : { ...normalizeAuthPermissions(user as unknown as Parameters<typeof normalizeAuthPermissions>[0]), authRules: [], overviewStores: [] as OverviewStore[] };
            // Cross-reference user.stores (from /auth/me) to attach human-readable storeId
            const meIdMap = new Map<string, string>();
            user.stores?.forEach((s) => {
              if (s.store.internalId !== undefined) {
                meIdMap.set(String(s.store.internalId), s.store.id);
              }
            });
            const enrichedMeStores = overviewStores.map((s) => ({
              ...s,
              storeId: meIdMap.get(s.id) ?? s.id,
            }));
            set({
              user,
              permissions: extractPermissions(user),
              roles: extractRoles(user),
              globalPermissions,
              storePermissions,
              authRules,
              overviewStores: enrichedMeStores,
              isAuthenticated: true,
              isLoading: false,
            });
            persistUserData(user);
          } else {
            set({
              user: null,
              token: null,
              permissions: [],
              roles: [],
              globalPermissions: new Set<string>(),
              storePermissions: {},
              overviewStores: [],
              isAuthenticated: false,
              isLoading: false,
            });
            persistUserData(null);
          }
        } catch {
          set({
            user: null,
            token: null,
            permissions: [],
            roles: [],
            globalPermissions: new Set<string>(),
            storePermissions: {},
            overviewStores: [],
            isAuthenticated: false,
            isLoading: false,
          });
          persistUserData(null);
        }
      },

      initialize: () => {
        set({ isInitialized: true });
      },

      // Permission checking methods
      hasPermission: (permission: string) => {
        const { permissions } = get();
        return permissions.includes(permission);
      },

      hasAnyPermission: (permissionList: string[]) => {
        if (!permissionList.length) return false;
        const { permissions } = get();
        return permissionList.some(p => permissions.includes(p));
      },

      hasAllPermissions: (permissionList: string[]) => {
        if (!permissionList.length) return false;
        const { permissions } = get();
        return permissionList.every(p => permissions.includes(p));
      },

      hasRole: (role: string) => {
        const { roles } = get();
        return roles.includes(role);
      },

      hasAnyRole: (roleList: string[]) => {
        if (!roleList.length) return false;
        const { roles } = get();
        return roleList.some(r => roles.includes(r));
      },

      hasAllRoles: (roleList: string[]) => {
        if (!roleList.length) return false;
        const { roles } = get();
        return roleList.every(r => roles.includes(r));
      },

      isSuperAdmin: () => {
        return get().hasRole("super-admin");
      },

      canAccess: (requiredPermissions?: string[], requiredRoles?: string[]) => {
        const state = get();
        
        // Super admin can access everything
        if (state.isSuperAdmin()) return true;
        
        let hasRequiredPermissions = true;
        let hasRequiredRoles = true;

        if (requiredPermissions && requiredPermissions.length > 0) {
          hasRequiredPermissions = state.hasAnyPermission(requiredPermissions);
        }

        if (requiredRoles && requiredRoles.length > 0) {
          hasRequiredRoles = state.hasAnyRole(requiredRoles);
        }

        return hasRequiredPermissions && hasRequiredRoles;
      },

      /**
       * Rule-based authorization — matches auth rules by service/method/path,
       * then checks the user's global or store-scoped permissions.
       */
      canAccessRoute: (params: CanAccessParams) => {
        const state = get();
        // Super-admin bypasses all rules
        if (state.isSuperAdmin()) return true;
        return canAccessFn(
          params,
          state.globalPermissions,
          state.storePermissions,
          state.authRules
        );
      },

      // Store access helpers
      getUserStores: () => {
        const { user } = get();
        return user?.stores || [];
      },

      hasStoreAccess: (storeId: string) => {
        const { user } = get();
        if (!user?.stores) return false;
        return user.stores.some(s => s.store.id === storeId);
      },

      getStorePermissions: (storeId: string) => {
        const { user } = get();
        const store = user?.stores?.find(s => s.store.id === storeId);
        return store?.effectivePermissions?.map(p => p.name) || [];
      },

      getStoreRoles: (storeId: string) => {
        const { user } = get();
        const store = user?.stores?.find(s => s.store.id === storeId);
        return store?.effectiveRoles?.map(r => r.name) || [];
      },
    }),
    {
      name: "auth-token",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      partialize: (state) => ({
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth-storage");
        }
        if (state) {
          state.initialize();
          state.checkAuth();
        }
      },
    }
  )
);
