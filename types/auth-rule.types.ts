/**
 * Authorization Rules Types
 * Comprehensive type definitions for Authorization Rules Management.
 */

// ============================================================================
// Core Entities & Enums
// ============================================================================

/**
 * HTTP methods supported by auth rules
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "ANY";

/**
 * Core AuthRule entity
 */
export interface AuthRule {
  id: string | number;
  service: string;
  method: HttpMethod;
  /** Alias for method - for backward compatibility */
  httpMethod?: HttpMethod;
  pathDsl: string | null;
  pathRegex: string | null;
  routeName: string | null;
  rolesAny: string[] | null;
  permissionsAny: string[] | null;
  permissionsAll: string[] | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  // Snake_case aliases for API compatibility
  path_dsl?: string | null;
  path_regex?: string | null;
  route_name?: string | null;
  roles_any?: string[] | null;
  permissions_any?: string[] | null;
  permissions_all?: string[] | null;
  is_active?: boolean;
  // Store-scoped rule fields (snake_case from API)
  store_scope_mode?: string | null;
  store_id_sources?: string[] | null;
  store_match_policy?: string | null;
  store_allows_empty?: boolean;
  store_all_access_roles_any?: string[] | null;
  store_all_access_permissions_any?: string[] | null;
  created_at?: string;
  updated_at?: string;
  // CamelCase aliases for convenience
  storeScopeMode?: string | null;
  storeIdSources?: string[] | null;
  storeMatchPolicy?: string | null;
  storeAllowsEmpty?: boolean;
  storeAllAccessRolesAny?: string[] | null;
  storeAllAccessPermissionsAny?: string[] | null;
}

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Query parameters for fetching auth rules
 */
export interface GetAuthRulesParams {
  service?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

/**
 * Base fields common to both pathDsl and routeName rule creation
 */
interface CreateAuthRuleBase {
  service: string;
  method: HttpMethod;
  priority?: number;
  isActive: boolean;
  rolesAny?: string[];
  permissionsAny?: string[];
  permissionsAll?: string[];
  storeScopeMode?: string;
  storeIdSources?: string[];
  storeMatchPolicy?: string;
  storeAllowsEmpty?: boolean;
  storeAllAccessRolesAny?: string[];
  storeAllAccessPermissionsAny?: string[];
}

/**
 * Create auth rule using pathDsl (dynamic path matching)
 */
export interface CreateAuthRuleWithPathDsl extends CreateAuthRuleBase {
  pathDsl: string;
  routeName?: never;
}

/**
 * Create auth rule using routeName (named route matching)
 */
export interface CreateAuthRuleWithRouteName extends CreateAuthRuleBase {
  routeName: string;
  pathDsl?: never;
}

/**
 * Union type for create auth rule requests
 */
export type CreateAuthRulePayload =
  | CreateAuthRuleWithPathDsl
  | CreateAuthRuleWithRouteName;

/**
 * Update auth rule payload
 */
export interface UpdateAuthRulePayload {
  service?: string;
  method?: HttpMethod;
  pathDsl?: string;
  routeName?: string;
  priority?: number;
  isActive?: boolean;
  rolesAny?: string[];
  permissionsAny?: string[];
  permissionsAll?: string[];
  storeScopeMode?: string;
  storeIdSources?: string[];
  storeMatchPolicy?: string;
  storeAllowsEmpty?: boolean;
  storeAllAccessRolesAny?: string[];
  storeAllAccessPermissionsAny?: string[];
}

/**
 * Test auth rule path matching request
 */
export interface TestAuthRulePayload {
  pathDsl: string;
  testPath: string;
}

/**
 * Test auth rule response
 */
export interface TestAuthRuleResult {
  matches: boolean;
  pathDsl: string;
  testPath: string;
  capturedParams?: Record<string, string>;
}

// ============================================================================
// State Types
// ============================================================================

export interface AuthRuleAsyncStates {
  fetchRules: { loading: boolean; error: string | null };
  fetchRule: { loading: boolean; error: string | null };
  createRule: { loading: boolean; error: string | null };
  updateRule: { loading: boolean; error: string | null };
  deleteRule: { loading: boolean; error: string | null };
  testRule: { loading: boolean; error: string | null };
}

export interface AuthRuleFilters {
  search?: string;
  service?: string;
  method?: HttpMethod;
  isActive?: boolean;
  sortField?: "service" | "method" | "priority" | "createdAt";
  sortDirection?: "asc" | "desc";
}

// ============================================================================
// Form Types
// ============================================================================

export interface AuthRuleFormData {
  service: string;
  method: HttpMethod;
  pathType: "dsl" | "routeName";
  pathDsl: string;
  routeName: string;
  priority: number;
  isActive: boolean;
  rolesAny: string[];
  permissionsAny: string[];
  permissionsAll: string[];
}
