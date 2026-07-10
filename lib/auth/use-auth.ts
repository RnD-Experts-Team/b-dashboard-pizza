"use client";

import { useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "./auth.store";
import type { LoginCredentials } from "@/types/auth.types";
import type { CanAccessParams } from "./can-access";

/**
 * Main authentication hook with permission checking capabilities
 * 
 * Usage:
 * ```tsx
 * const { hasPermission, canAccess, isSuperAdmin } = useAuth();
 * 
 * if (hasPermission('manage users')) {
 *   // Show user management UI
 * }
 * 
 * if (canAccess(['manage roles'], ['admin'])) {
 *   // Show admin features
 * }
 * ```
 */
export function useAuth() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    isInitialized,
    permissions,
    roles,
    login: storeLogin,
    logout: storeLogout,
    checkAuth,
    // Impersonation
    isImpersonating,
    isImpersonationLoading,
    impersonateUser: storeImpersonateUser,
    stopImpersonating: storeStopImpersonating,
    // Permission methods
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    isSuperAdmin,
    canAccess,
    // Store methods
    getUserStores,
    hasStoreAccess,
    getStorePermissions,
    getStoreRoles,
    // Rule-based access
    canAccessRoute,
  } = useAuthStore();

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      await storeLogin(credentials);
      router.push(`/${locale}/dashboard`);
    },
    [storeLogin, router, locale]
  );

  const logout = useCallback(() => {
    storeLogout();
    router.push(`/${locale}/auth/login`);
  }, [storeLogout, router, locale]);

  // Impersonation switches identity out from under every zustand store in
  // the app, most of which aren't wired to reset themselves — a full page
  // reload (not router.push) is required to guarantee no stale, previous-
  // identity data survives the switch.
  const impersonateUser = useCallback(
    async (userId: string) => {
      await storeImpersonateUser(userId);
      window.location.href = `/${locale}/dashboard`;
    },
    [storeImpersonateUser, locale]
  );

  const stopImpersonating = useCallback(() => {
    storeStopImpersonating();
    window.location.href = `/${locale}/dashboard`;
  }, [storeStopImpersonating, locale]);

  return {
    // User data
    user,
    token,

    // Status
    isAuthenticated,
    isLoading,
    isInitialized,

    // Derived data
    permissions,
    roles,

    // Actions
    login,
    logout,
    checkAuth,

    // Impersonation
    isImpersonating,
    isImpersonationLoading,
    impersonateUser,
    stopImpersonating,

    // Permission checks
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    isSuperAdmin,
    canAccess,
    
    // Store access
    getUserStores,
    hasStoreAccess,
    getStorePermissions,
    getStoreRoles,

    // Rule-based access
    canAccessRoute,
  };
}

/**
 * Hook for checking specific permission in components
 * 
 * Usage:
 * ```tsx
 * const canManageUsers = usePermission('manage users');
 * ```
 */
export function usePermission(permission: string): boolean {
  const { hasPermission } = useAuthStore();
  return hasPermission(permission);
}

/**
 * Hook for checking specific role in components
 * 
 * Usage:
 * ```tsx
 * const isAdmin = useRole('admin');
 * ```
 */
export function useRole(role: string): boolean {
  const { hasRole } = useAuthStore();
  return hasRole(role);
}

/**
 * Hook for checking access with both permissions and roles (legacy)
 *
 * Usage:
 * ```tsx
 * const hasAccess = useCanAccess(['manage users'], ['admin']);
 * ```
 */
export function useCanAccess(
  requiredPermissions?: string[],
  requiredRoles?: string[]
): boolean {
  const { canAccess } = useAuthStore();
  return canAccess(requiredPermissions, requiredRoles);
}

/**
 * Rule-based authorization hook.
 * Matches the auth rule for the given service/method/path and evaluates
 * the user's permissions against it.
 *
 * Usage:
 * ```tsx
 * const canCreate = useCanAccessRoute({
 *   service: "Data",
 *   method: "POST",
 *   path: "/engine/keys",
 * });
 * ```
 */
export function useCanAccessRoute(params: CanAccessParams): boolean {
  const { canAccessRoute } = useAuthStore();
  return canAccessRoute(params);
}
