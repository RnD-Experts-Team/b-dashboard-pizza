"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, X } from "lucide-react";
import { useCreateAuthRule, useUpdateAuthRule } from "@/lib/hooks/use-auth-rules";
import { useRoles } from "@/lib/hooks/use-roles";
import { usePermissions } from "@/lib/hooks/use-permissions";
import type { AuthRule, HttpMethod, CreateAuthRulePayload, UpdateAuthRulePayload } from "@/types/auth-rule.types";

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
  storeAllAccessRolesAny?: string[];
  storeAllAccessPermissionsAny?: string[];
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
    storeAllAccessRolesAny:
      rule?.storeAllAccessRolesAny || rule?.store_all_access_roles_any || [],
    storeAllAccessPermissionsAny:
      rule?.storeAllAccessPermissionsAny || rule?.store_all_access_permissions_any || [],
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
  // keys to force remount of Select components to clear their internal value after add
  const [roleSelectKey, setRoleSelectKey] = useState(0);
  const [storeRoleSelectKey, setStoreRoleSelectKey] = useState(0);
  const [permissionAnySelectKey, setPermissionAnySelectKey] = useState(0);
  const [permissionAllSelectKey, setPermissionAllSelectKey] = useState(0);
  const [storePermissionSelectKey, setStorePermissionSelectKey] = useState(0);

  useEffect(() => {
    if (isEditMode && rule) {
      setFormData(buildInitialFormData(rule));
    }
  }, [isEditMode, rule?.id, rule?.updatedAt, rule?.updated_at]);

  const handleChange = (field: keyof AuthRuleFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddRole = (roleName: string) => {
    if (!formData.rolesAny?.includes(roleName)) {
      setFormData((prev) => ({
        ...prev,
        rolesAny: [...(prev.rolesAny || []), roleName],
      }));
      // reset the select by remounting it
      setRoleSelectKey((k) => k + 1);
    }
  };

  const handleRemoveRole = (roleName: string) => {
    setFormData((prev) => ({
      ...prev,
      rolesAny: prev.rolesAny?.filter((name) => name !== roleName) || [],
    }));
    // reset the select in case it was showing the removed value
    setRoleSelectKey((k) => k + 1);
  };

  const handleAddPermission = (
    type: "permissionsAny" | "permissionsAll" | "storeAllAccessPermissionsAny",
    value: string
  ) => {
    if (value && !formData[type]?.includes(value)) {
      setFormData((prev) => ({
        ...prev,
        [type]: [...(prev[type] || []), value],
      }));

      if (type === "permissionsAny") {
        setPermissionAnySelectKey((k) => k + 1);
      } else if (type === "permissionsAll") {
        setPermissionAllSelectKey((k) => k + 1);
      } else {
        setStorePermissionSelectKey((k) => k + 1);
      }
    }
  };

  const handleRemovePermission = (
    type: "permissionsAny" | "permissionsAll",
    permission: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [type]: prev[type]?.filter((p) => p !== permission) || [],
    }));
  };

  // Store-scoped access handlers
  const handleAddStoreRole = (roleName: string) => {
    if (!formData.storeAllAccessRolesAny?.includes(roleName)) {
      setFormData((prev) => ({
        ...prev,
        storeAllAccessRolesAny: [...(prev.storeAllAccessRolesAny || []), roleName],
      }));
      // reset the select by remounting it
      setStoreRoleSelectKey((k) => k + 1);
    }
  };

  const handleRemoveStoreRole = (roleName: string) => {
    setFormData((prev) => ({
      ...prev,
      storeAllAccessRolesAny:
        prev.storeAllAccessRolesAny?.filter((name) => name !== roleName) || [],
    }));
    // reset the select in case it was showing the removed value
    setStoreRoleSelectKey((k) => k + 1);
  };

  const handleRemoveStorePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      storeAllAccessPermissionsAny:
        prev.storeAllAccessPermissionsAny?.filter((p) => p !== permission) || [],
    }));
    setStorePermissionSelectKey((k) => k + 1);
  };

  const availablePermissions = permissions.map((permission) => permission.name);

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
          storeAllAccessRolesAny: formData.storeAllAccessRolesAny && formData.storeAllAccessRolesAny.length > 0 ? formData.storeAllAccessRolesAny : [],
          storeAllAccessPermissionsAny: formData.storeAllAccessPermissionsAny && formData.storeAllAccessPermissionsAny.length > 0 ? formData.storeAllAccessPermissionsAny : [],
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
              storeAllAccessRolesAny: formData.storeAllAccessRolesAny && formData.storeAllAccessRolesAny.length > 0 ? formData.storeAllAccessRolesAny : [],
              storeAllAccessPermissionsAny: formData.storeAllAccessPermissionsAny && formData.storeAllAccessPermissionsAny.length > 0 ? formData.storeAllAccessPermissionsAny : [],
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
              storeAllAccessRolesAny: formData.storeAllAccessRolesAny && formData.storeAllAccessRolesAny.length > 0 ? formData.storeAllAccessRolesAny : [],
              storeAllAccessPermissionsAny: formData.storeAllAccessPermissionsAny && formData.storeAllAccessPermissionsAny.length > 0 ? formData.storeAllAccessPermissionsAny : [],
            };
        result = await createRule(payload);
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/${locale}/dashboard/auth-rules`);
      }
    } catch {
      // Error is handled by the hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {(error || validationError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || validationError}</AlertDescription>
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
            {(formData.rolesAny?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.rolesAny?.map((roleName) => (
                  <Badge key={roleName} variant="secondary" className="text-xs">
                    {roleName}
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(roleName)}
                      className="ms-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Select key={`role-select-${roleSelectKey}`} onValueChange={handleAddRole}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("form.selectRolePlaceholder")} />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT_CLASS}>
                {roles
                  .filter((r) => !formData.rolesAny?.includes(r.name))
                  .map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label>{t("form.permissionsAny")}</Label>
                <span className="text-xs text-muted-foreground">{t("form.permissionsAnyHint")}</span>
              </div>
              {(formData.permissionsAny?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {formData.permissionsAny?.map((permission) => (
                    <Badge key={permission} variant="secondary" className="text-xs">
                      {permission}
                      <button
                        type="button"
                        onClick={() => handleRemovePermission("permissionsAny", permission)}
                        className="ms-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <Select
                key={`permission-any-select-${permissionAnySelectKey}`}
                onValueChange={(value) => handleAddPermission("permissionsAny", value)}
              >
                <SelectTrigger className="w-full" disabled={isLoadingPermissions}>
                  <SelectValue placeholder={t("form.selectPermissionPlaceholder")} />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  {availablePermissions
                    .filter((p) => !formData.permissionsAny?.includes(p))
                    .map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label>{t("form.permissionsAll")}</Label>
                <span className="text-xs text-muted-foreground">{t("form.permissionsAllHint")}</span>
              </div>
              {(formData.permissionsAll?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {formData.permissionsAll?.map((permission) => (
                    <Badge key={permission} variant="secondary" className="text-xs">
                      {permission}
                      <button
                        type="button"
                        onClick={() => handleRemovePermission("permissionsAll", permission)}
                        className="ms-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <Select
                key={`permission-all-select-${permissionAllSelectKey}`}
                onValueChange={(value) => handleAddPermission("permissionsAll", value)}
              >
                <SelectTrigger className="w-full" disabled={isLoadingPermissions}>
                  <SelectValue placeholder={t("form.selectPermissionPlaceholder")} />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  {availablePermissions
                    .filter((p) => !formData.permissionsAll?.includes(p))
                    .map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
              <Input
                id="storeMatchPolicy"
                value={formData.storeMatchPolicy || ""}
                onChange={(e) => handleChange("storeMatchPolicy", e.target.value)}
                placeholder={t("form.storeMatchPolicyPlaceholder")}
              />
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

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label>{t("form.storeAllAccessRolesAny")}</Label>
                <span className="text-xs text-muted-foreground">{t("form.storeAllAccessRolesAnyHint")}</span>
              </div>
              {(formData.storeAllAccessRolesAny?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {formData.storeAllAccessRolesAny?.map((roleName) => (
                    <Badge key={roleName} variant="secondary" className="text-xs">
                      {roleName}
                      <button
                        type="button"
                        onClick={() => handleRemoveStoreRole(roleName)}
                        className="ms-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <Select key={`store-role-select-${storeRoleSelectKey}`} onValueChange={handleAddStoreRole}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("form.selectRolePlaceholder")} />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  {roles
                    .filter((r) => !formData.storeAllAccessRolesAny?.includes(r.name))
                    .map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label>{t("form.storeAllAccessPermissionsAny")}</Label>
                <span className="text-xs text-muted-foreground">{t("form.storeAllAccessPermissionsAnyHint")}</span>
              </div>
              {(formData.storeAllAccessPermissionsAny?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {formData.storeAllAccessPermissionsAny?.map((permission) => (
                    <Badge key={permission} variant="secondary" className="text-xs">
                      {permission}
                      <button
                        type="button"
                        onClick={() => handleRemoveStorePermission(permission)}
                        className="ms-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <Select
                key={`store-permission-select-${storePermissionSelectKey}`}
                onValueChange={(value) => handleAddPermission("storeAllAccessPermissionsAny", value)}
              >
                <SelectTrigger className="w-full" disabled={isLoadingPermissions}>
                  <SelectValue placeholder={t("form.selectPermissionPlaceholder")} />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  {availablePermissions
                    .filter((p) => !formData.storeAllAccessPermissionsAny?.includes(p))
                    .map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
