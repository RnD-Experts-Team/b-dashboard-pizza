import { create } from "zustand";
import { authRuleService } from "@/lib/api/services/auth-rule.service";
import type {
  AuthRule,
  GetAuthRulesParams,
  CreateAuthRulePayload,
  UpdateAuthRulePayload,
  TestAuthRulePayload,
  TestAuthRuleResult,
  AuthRuleFilters,
} from "@/types/auth-rule.types";
import type { PaginatedResponse } from "@/types/api.types";

interface AuthRulesState {
  // Data
  rules: AuthRule[];
  currentRule: AuthRule | null;
  services: string[];
  testResult: TestAuthRuleResult | null;
  pagination: PaginatedResponse<AuthRule>["meta"] | null;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isToggling: boolean;
  isDeleting: boolean;
  isTesting: boolean;

  // Error states
  error: string | null;
  createError: string | null;
  updateError: string | null;
  deleteError: string | null;
  testError: string | null;

  // UI state
  filters: AuthRuleFilters;
  selectedRuleId: string | null;

  // Actions
  fetchRules: (params?: GetAuthRulesParams) => Promise<void>;
  fetchRule: (id: string) => Promise<AuthRule | null>;
  createRule: (data: CreateAuthRulePayload) => Promise<AuthRule>;
  updateRule: (id: string, data: UpdateAuthRulePayload) => Promise<AuthRule>;
  deleteRule: (id: string) => Promise<void>;
  toggleStatus: (id: string) => Promise<void>;
  testRule: (data: TestAuthRulePayload) => Promise<TestAuthRuleResult>;
  fetchServices: () => Promise<void>;
  setFilters: (filters: Partial<AuthRuleFilters>) => void;
  setSelectedRuleId: (id: string | null) => void;
  clearTestResult: () => void;
  clearErrors: () => void;
  reset: () => void;
}

const initialState = {
  rules: [],
  currentRule: null,
  services: [],
  testResult: null,
  pagination: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isToggling: false,
  isDeleting: false,
  isTesting: false,
  error: null,
  createError: null,
  updateError: null,
  deleteError: null,
  testError: null,
  filters: {},
  selectedRuleId: null,
};

export const useAuthRulesStore = create<AuthRulesState>()((set, get) => ({
  ...initialState,

  fetchRules: async (params?: GetAuthRulesParams) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authRuleService.getAuthRules(params);
      set({
        rules: response.data,
        pagination: response.meta,
        isLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch auth rules";
      set({ error: message, isLoading: false });
    }
  },

  fetchRule: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authRuleService.getAuthRule(id);
      if (response.success) {
        set({ currentRule: response.data, isLoading: false });
        return response.data;
      }
      throw new Error("Failed to fetch auth rule");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch auth rule";
      set({ error: message, isLoading: false });
      return null;
    }
  },

  createRule: async (data: CreateAuthRulePayload) => {
    set({ isCreating: true, createError: null });
    try {
      const response = await authRuleService.createAuthRule(data);
      if (response.success) {
        await get().fetchRules();
        set({ isCreating: false });
        return response.data;
      }
      throw new Error(response.message || "Failed to create auth rule");
    } catch (error: unknown) {
      const axErr = error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const apiMsg = axErr?.response?.data?.message;
      const fieldErrors = axErr?.response?.data?.errors;
      const fieldSummary = fieldErrors
        ? Object.values(fieldErrors).flat().join(". ")
        : null;
      const message =
        fieldSummary || apiMsg || (error instanceof Error ? error.message : "Failed to create auth rule");
      set({ createError: message, isCreating: false });
      throw error;
    }
  },

  updateRule: async (id: string, data: UpdateAuthRulePayload) => {
    set({ isUpdating: true, updateError: null });
    try {
      const response = await authRuleService.updateAuthRule(id, data);
      if (response.success) {
        set((state) => ({
          rules: state.rules.map((r) =>
            String(r.id) === String(id) ? { ...r, ...response.data } : r
          ),
          currentRule:
            String(state.currentRule?.id) === String(id)
              ? { ...state.currentRule, ...response.data }
              : state.currentRule,
          isUpdating: false,
        }));
        return response.data;
      }
      throw new Error(response.message || "Failed to update auth rule");
    } catch (error: unknown) {
      const axErr = error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const apiMsg = axErr?.response?.data?.message;
      const fieldErrors = axErr?.response?.data?.errors;
      const fieldSummary = fieldErrors
        ? Object.values(fieldErrors).flat().join(". ")
        : null;
      const message =
        fieldSummary || apiMsg || (error instanceof Error ? error.message : "Failed to update auth rule");
      set({ updateError: message, isUpdating: false });
      throw error;
    }
  },

  deleteRule: async (id: string) => {
    set({ isDeleting: true, deleteError: null });
    try {
      await authRuleService.deleteAuthRule(id);
      set((state) => ({
        rules: state.rules.filter((r) => String(r.id) !== String(id)),
        currentRule: String(state.currentRule?.id) === String(id) ? null : state.currentRule,
        isDeleting: false,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete auth rule";
      set({ deleteError: message, isDeleting: false });
      throw error;
    }
  },

  toggleStatus: async (id: string) => {
    set({ isToggling: true, error: null });
    try {
      const response = await authRuleService.toggleAuthRuleStatus(id);
      if (response.success) {
        set((state) => ({
          rules: state.rules.map((r) =>
            String(r.id) === String(id) ? { ...r, isActive: !r.isActive } : r
          ),
          currentRule:
            String(state.currentRule?.id) === String(id)
              ? (({ ...state.currentRule, isActive: !state.currentRule!.isActive }) as AuthRule)
              : state.currentRule,
          isToggling: false,
        }));
        return;
      }
      throw new Error(response.message || "Failed to toggle auth rule status");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to toggle auth rule status";
      set({ error: message, isToggling: false });
      throw error;
    }
  },

  testRule: async (data: TestAuthRulePayload) => {
    set({ isTesting: true, testError: null, testResult: null });
    try {
      const response = await authRuleService.testAuthRule(data);
      if (response.success) {
        set({ testResult: response.data, isTesting: false });
        return response.data;
      }
      throw new Error(response.message || "Failed to test auth rule");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to test auth rule";
      set({ testError: message, isTesting: false });
      throw error;
    }
  },

  fetchServices: async () => {
    try {
      const response = await authRuleService.getServices();
      if (response.success) {
        set({ services: response.data });
      }
    } catch (error) {
      console.error("Failed to fetch services:", error);
    }
  },

  setFilters: (filters: Partial<AuthRuleFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  setSelectedRuleId: (id: string | null) => {
    set({ selectedRuleId: id });
  },

  clearTestResult: () => {
    set({ testResult: null, testError: null });
  },

  clearErrors: () => {
    set({
      error: null,
      createError: null,
      updateError: null,
      deleteError: null,
      testError: null,
    });
  },

  reset: () => {
    set(initialState);
  },
}));
