"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, Search, CheckSquare, Square } from "lucide-react";
import { useCreateAuthRule, useUpdateAuthRule } from "@/lib/hooks/use-auth-rules";
import { useRoles } from "@/lib/hooks/use-roles";
import { usePermissions } from "@/lib/hooks/use-permissions";
import type { AuthRule, HttpMethod, CreateAuthRulePayload, UpdateAuthRulePayload } from "@/types/auth-rule.types";

// ── Multi-select checkbox panel ──────────────────────────────────
interface MultiSelectPanelProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  searchPlaceholder?: string;
  disabled?: boolean;
}

function MultiSelectPanel({
  options,
  selected,
  onChange,
  searchPlaceholder = "Search…",
  disabled,
}: MultiSelectPanelProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query) return options;
    const lc = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(lc));
  }, [options, query]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.includes(o));

  const handleToggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  const handleSelectAll = () => {
    const merged = Array.from(new Set([...selected, ...filtered]));
    onChange(merged);
  };

  const handleDeselectAll = () => {
    const filteredSet = new Set(filtered);
    onChange(selected.filter((s) => !filteredSet.has(s)));
  };

  return (
    <div className="rounded-md border">
      {/* Search + bulk actions */}
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          className="h-7 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
        />
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          onClick={allFilteredSelected ? handleDeselectAll : handleSelectAll}
          disabled={disabled || filtered.length === 0}
          title={allFilteredSelected ? "Deselect all" : "Select all"}
        >
          {allFilteredSelected ? (
            <Square className="h-3 w-3" />
          ) : (
            <CheckSquare className="h-3 w-3" />
          )}
          {allFilteredSelected ? "None" : "All"}
        </button>
      </div>

      {/* Options list */}
      <div className="h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No items found
          </p>
        ) : (
          filtered.map((item) => {
            const isChecked = selected.includes(item);
            return (
              <label
                key={item}
                className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-accent"
              >
                <Checkbox
                  checked={isChecked}
                  disabled={disabled}
                  onCheckedChange={() => handleToggle(item)}
                />
                <span className="truncate">{item}</span>
              </label>
            );
          })
        )}
      </div>

      {/* Footer count */}
      <div className="border-t px-2.5 py-1 text-[11px] text-muted-foreground">
        {selected.length} selected
      </div>
    </div>
  );
}

// ── Constants ────────────────────────────────────────────────────
const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "ANY",
];

const STORE_SCOPE_OPTIONS = [
  { value: "none", labelKey: "form.storeScopeModes.none" },
  { value: "scoped", labelKey: "form.storeScopeModes.scoped" },
  { value: "all_stores", labelKey: "form.storeScopeModes.allStores" },
] as const;

const STORE_ID_SOURCE_OPTIONS = [
  { value: "path", labelKey: "form.storeIdSource.path" },
  { value: "query", labelKey: "form.storeIdSource.query" },
  { value: "body", labelKey: "form.storeIdSource.body" },
] as const;

const STORE_MATCH_POLICY_OPTIONS = [
  { value: "all", labelKey: "form.storeMatchPolicies.all" },
  { value: "any", labelKey: "form.storeMatchPolicies.any" },
] as const;

const SELECT_CONTENT_CLASS = "max-h-56 overflow-y-auto";

// Local form state type that allows both pathDsl and routeName
interface AuthRuleFormData {
  service: string;
  method: HttpMethod;
  pathDsl: string;
  routeName: string;
  rolesAny: string[];
  permissionsAny: string[];
  permissionsAll: string[];
  priority: number;
  isActive: boolean;
  // store scope fields
  storeScopeMode?: string;
  storeIdSources?: string[];
  storeMatchPolicy?: string;
  storeAllowsEmpty?: boolean;
}

interface AuthRuleFormProps {
  /** Existing rule data for edit mode */
  rule?: AuthRule;
  /** If true, form operates in edit mode */
  mode?: "create" | "edit";
  onSuccess?: (rule: AuthRule) => void;
}

function buildInitialFormData(rule?: AuthRule): AuthRuleFormData {
  return {
    service: rule?.service || "",
    method: rule?.method || "GET",
    pathDsl: rule?.pathDsl || rule?.path_dsl || "",
    routeName: rule?.routeName || rule?.route_name || "",
    rolesAny: rule?.rolesAny || rule?.roles_any || [],
    permissionsAny: rule?.permissionsAny || rule?.permissions_any || [],
    permissionsAll: rule?.permissionsAll || rule?.permissions_all || [],
    priority: rule?.priority || 1,
    isActive: rule?.isActive ?? rule?.is_active ?? true,
    storeScopeMode: rule?.storeScopeMode || rule?.store_scope_mode || "none",
    storeIdSources: rule?.storeIdSources || rule?.store_id_sources || [],
    storeMatchPolicy: rule?.storeMatchPolicy || rule?.store_match_policy || "all",
    storeAllowsEmpty: rule?.storeAllowsEmpty ?? rule?.store_allows_empty ?? false,
  };
}

export function AuthRuleForm({ rule, mode = "create", onSuccess }: AuthRuleFormProps) {
  const t = useTranslations("authRules");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const { createRule, isCreating, error: createError } = useCreateAuthRule();
  const { updateRule, isUpdating, updateError } = useUpdateAuthRule(
    mode === "edit" && rule ? String(rule.id) : null
  );
  const { roles } = useRoles();
  const {
    permissions,
    isLoading: isLoadingPermissions,
    error: permissionsError,
  } = usePermissions({ perPage: 200 });

  const isEditMode = mode === "edit" && !!rule;
  const isBusy = isEditMode ? isUpdating : isCreating;
  const error = isEditMode ? updateError : createError;

  const [formData, setFormData] = useState<AuthRuleFormData>(() =>
    buildInitialFormData(rule)
  );

  const [validationError, setValidationError] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");

  useEffect(() => {
    if (isEditMode && rule) {
      setFormData(buildInitialFormData(rule));
    }
  }, [isEditMode, rule?.id, rule?.updatedAt, rule?.updated_at]);

  const handleChange = (field: keyof AuthRuleFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const availableRoleNames = roles.map((r) => r.name);
  const availablePermissions = permissions.map((p) => p.name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.service?.trim()) {
      setValidationError(t("form.validation.serviceRequired"));
      return;
    }
    if (!formData.method) {
      setValidationError(t("form.validation.methodRequired"));
      return;
    }
    if (!formData.pathDsl?.trim() && !formData.routeName?.trim()) {
      setValidationError(t("form.validation.pathOrRouteRequired"));
      return;
    }
    
    setValidationError("");
    setSubmitError("");

    try {
      let result: AuthRule;

      if (isEditMode) {
        // Edit mode — send update payload
        const updatePayload: UpdateAuthRulePayload = {
          service: formData.service.trim(),
          method: formData.method,
          pathDsl: formData.pathDsl?.trim() || undefined,
          routeName: formData.routeName?.trim() || undefined,
          rolesAny: formData.rolesAny && formData.rolesAny.length > 0 ? formData.rolesAny : [],
          permissionsAny: formData.permissionsAny && formData.permissionsAny.length > 0 ? formData.permissionsAny : [],
          permissionsAll: formData.permissionsAll && formData.permissionsAll.length > 0 ? formData.permissionsAll : [],
          priority: formData.priority,
          isActive: formData.isActive,
          storeScopeMode: formData.storeScopeMode,
          storeIdSources: formData.storeIdSources,
          storeMatchPolicy: formData.storeMatchPolicy,
          storeAllowsEmpty: formData.storeAllowsEmpty,
        };
        result = await updateRule(updatePayload);
      } else {
        // Create mode
        const payload: CreateAuthRulePayload = formData.pathDsl?.trim()
          ? {
              service: formData.service.trim(),
              method: formData.method,
              pathDsl: formData.pathDsl.trim(),
              rolesAny: formData.rolesAny && formData.rolesAny.length > 0 ? formData.rolesAny : [],
              permissionsAny: formData.permissionsAny && formData.permissionsAny.length > 0 ? formData.permissionsAny : [],
              permissionsAll: formData.permissionsAll && formData.permissionsAll.length > 0 ? formData.permissionsAll : [],
              priority: formData.priority,
              isActive: formData.isActive,
              storeScopeMode: formData.storeScopeMode,
              storeIdSources: formData.storeIdSources,
              storeMatchPolicy: formData.storeMatchPolicy,
              storeAllowsEmpty: formData.storeAllowsEmpty,
            }
          : {
              service: formData.service.trim(),
              method: formData.method,
              routeName: formData.routeName!.trim(),
              rolesAny: formData.rolesAny && formData.rolesAny.length > 0 ? formData.rolesAny : [],
              permissionsAny: formData.permissionsAny && formData.permissionsAny.length > 0 ? formData.permissionsAny : [],
              permissionsAll: formData.permissionsAll && formData.permissionsAll.length > 0 ? formData.permissionsAll : [],
              priority: formData.priority,
              isActive: formData.isActive,
              storeScopeMode: formData.storeScopeMode,
              storeIdSources: formData.storeIdSources,
              storeMatchPolicy: formData.storeMatchPolicy,
              storeAllowsEmpty: formData.storeAllowsEmpty,
            };
        result = await createRule(payload);
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/${locale}/dashboard/auth-rules`);
      }
    } catch (err: unknown) {
      // Show API error in the form — the store also captures it,
      // but we surface it locally so users see it immediately.
      const axErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const apiMsg = axErr?.response?.data?.message;
      const fieldErrors = axErr?.response?.data?.errors;
      const fieldSummary = fieldErrors
        ? Object.values(fieldErrors).flat().join(". ")
        : null;
      const msg =
        fieldSummary || apiMsg || (err instanceof Error ? err.message : "");
      if (msg) setSubmitError(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {(error || validationError || submitError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError || submitError || error}</AlertDescription>
        </Alert>
      )}

      {/* Route Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("form.routeInfo")}</CardTitle>
          <CardDescription className="text-xs">{t("form.routeInfoDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="service">{t("form.service")}</Label>
              <Input
                id="service"
                value={formData.service}
                onChange={(e) => handleChange("service", e.target.value)}
                placeholder={t("form.servicePlaceholder")}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="method">{t("form.method")}</Label>
              <Select
                value={formData.method}
                onValueChange={(value: HttpMethod) => handleChange("method", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  {HTTP_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pathDsl">{t("form.pathDsl")}</Label>
              <Input
                id="pathDsl"
                value={formData.pathDsl || ""}
                onChange={(e) => handleChange("pathDsl", e.target.value)}
                placeholder={t("form.pathDslPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("form.pathDslHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="routeName">{t("form.routeName")}</Label>
              <Input
                id="routeName"
                value={formData.routeName || ""}
                onChange={(e) => handleChange("routeName", e.target.value)}
                placeholder={t("form.routeNamePlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("form.routeNameHint")}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="priority">{t("form.priority")}</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) => handleChange("priority", parseInt(e.target.value, 10))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium leading-none">{t("form.status")}</p>
                <p className="text-xs text-muted-foreground">{t("form.statusDescription")}</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => handleChange("isActive", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authorization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("form.authorization")}</CardTitle>
          <CardDescription className="text-xs">{t("form.authorizationDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>{t("form.rolesAny")}</Label>
              <span className="text-xs text-muted-foreground">{t("form.rolesAnyHint")}</span>
            </div>
            <MultiSelectPanel
              options={availableRoleNames}
              selected={formData.rolesAny || []}
              onChange={(val) => handleChange("rolesAny", val)}
              searchPlaceholder={t("form.selectRolePlaceholder")}
            />
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label>{t("form.permissionsAny")}</Label>
                <span className="text-xs text-muted-foreground">{t("form.permissionsAnyHint")}</span>
              </div>
              <MultiSelectPanel
                options={availablePermissions}
                selected={formData.permissionsAny || []}
                onChange={(val) => handleChange("permissionsAny", val)}
                searchPlaceholder={t("form.selectPermissionPlaceholder")}
                disabled={isLoadingPermissions}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label>{t("form.permissionsAll")}</Label>
                <span className="text-xs text-muted-foreground">{t("form.permissionsAllHint")}</span>
              </div>
              <MultiSelectPanel
                options={availablePermissions}
                selected={formData.permissionsAll || []}
                onChange={(val) => handleChange("permissionsAll", val)}
                searchPlaceholder={t("form.selectPermissionPlaceholder")}
                disabled={isLoadingPermissions}
              />
            </div>
          </div>

          {permissionsError && (
            <p className="text-xs text-destructive">{t("form.permissionsLoadError")}</p>
          )}
        </CardContent>
      </Card>

      {/* Store Scope */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("form.storeScope")}</CardTitle>
          <CardDescription className="text-xs">{t("form.storeScopeDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="storeScopeMode">{t("form.storeScopeMode")}</Label>
              <Select
                value={formData.storeScopeMode}
                onValueChange={(value: string) => handleChange("storeScopeMode", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  {STORE_SCOPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("form.storeScopeModeHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="storeMatchPolicy">{t("form.storeMatchPolicy")}</Label>
              <Select
                value={formData.storeMatchPolicy || "all"}
                onValueChange={(value: string) => handleChange("storeMatchPolicy", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  {STORE_MATCH_POLICY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("form.storeMatchPolicyHint")}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("form.storeIdSources")}</Label>
              <div className="flex flex-wrap gap-4 pt-1">
                {STORE_ID_SOURCE_OPTIONS.map((source) => {
                  const sourceId = `store-id-source-${source.value}`;
                  return (
                    <label
                      key={source.value}
                      htmlFor={sourceId}
                      className="flex cursor-pointer items-center gap-1.5"
                    >
                      <Checkbox
                        id={sourceId}
                        checked={formData.storeIdSources?.includes(source.value)}
                        onCheckedChange={(checked) => {
                          const isChecked = checked === true;
                          setFormData((prev) => ({
                            ...prev,
                            storeIdSources: isChecked
                              ? Array.from(new Set([...(prev.storeIdSources || []), source.value]))
                              : (prev.storeIdSources || []).filter((s) => s !== source.value),
                          }));
                        }}
                      />
                      <span className="text-xs">{t(source.labelKey)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium leading-none">{t("form.storeAllowsEmpty")}</p>
                <p className="text-xs text-muted-foreground">{t("form.storeAllowsEmptyHint")}</p>
              </div>
              <Switch
                checked={!!formData.storeAllowsEmpty}
                onCheckedChange={(checked) => handleChange("storeAllowsEmpty", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${locale}/dashboard/auth-rules`)}
        >
          {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={isBusy}>
          {isBusy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {isEditMode ? tCommon("save") : t("form.create")}
        </Button>
      </div>
    </form>
  );
}
