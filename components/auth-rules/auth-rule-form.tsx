"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Loader2, AlertCircle, X, Plus } from "lucide-react";
import { useCreateAuthRule, useUpdateAuthRule } from "@/lib/hooks/use-auth-rules";
import { useRoles } from "@/lib/hooks/use-roles";
import type { AuthRule, HttpMethod, CreateAuthRulePayload, UpdateAuthRulePayload } from "@/types/auth-rule.types";

const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "ANY",
];

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

  const isEditMode = mode === "edit" && !!rule;
  const isBusy = isEditMode ? isUpdating : isCreating;
  const error = isEditMode ? updateError : createError;

  const [formData, setFormData] = useState<AuthRuleFormData>({
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
  });

  const [newPermissionAny, setNewPermissionAny] = useState("");
  const [newPermissionAll, setNewPermissionAll] = useState("");
  const [newStorePermission, setNewStorePermission] = useState("");
  const [validationError, setValidationError] = useState<string>("");
  // keys to force remount of Select components to clear their internal value after add
  const [roleSelectKey, setRoleSelectKey] = useState(0);
  const [storeRoleSelectKey, setStoreRoleSelectKey] = useState(0);

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

  const handleAddPermission = (type: "permissionsAny" | "permissionsAll") => {
    const value = type === "permissionsAny" ? newPermissionAny : newPermissionAll;
    if (value && !formData[type]?.includes(value)) {
      setFormData((prev) => ({
        ...prev,
        [type]: [...(prev[type] || []), value],
      }));
      if (type === "permissionsAny") setNewPermissionAny("");
      else setNewPermissionAll("");
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

  const handleAddStorePermission = () => {
    if (
      newStorePermission &&
      !formData.storeAllAccessPermissionsAny?.includes(newStorePermission)
    ) {
      setFormData((prev) => ({
        ...prev,
        storeAllAccessPermissionsAny: [
          ...(prev.storeAllAccessPermissionsAny || []),
          newStorePermission,
        ],
      }));
      setNewStorePermission("");
    }
  };

  const handleRemoveStorePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      storeAllAccessPermissionsAny:
        prev.storeAllAccessPermissionsAny?.filter((p) => p !== permission) || [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.service?.trim()) {
      setValidationError("Service is required");
      return;
    }
    if (!formData.method) {
      setValidationError("HTTP Method is required");
      return;
    }
    if (!formData.pathDsl?.trim() && !formData.routeName?.trim()) {
      setValidationError("Either Path DSL or Route Name is required");
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {(error || validationError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || validationError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("form.routeInfo")}</CardTitle>
            <CardDescription>{t("form.routeInfoDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="service">{t("form.service")}</Label>
                <Input
                  id="service"
                  value={formData.service}
                  onChange={(e) => handleChange("service", e.target.value)}
                  placeholder={t("form.servicePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">{t("form.method")}</Label>
                <Select
                  value={formData.method}
                  onValueChange={(value: HttpMethod) =>
                    handleChange("method", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HTTP_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Required field</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pathDsl">{t("form.pathDsl")}</Label>
              <Input
                id="pathDsl"
                value={formData.pathDsl || ""}
                onChange={(e) => handleChange("pathDsl", e.target.value)}
                placeholder={t("form.pathDslPlaceholder")}
              />
              <p className="text-sm text-muted-foreground">{t("form.pathDslHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="routeName">{t("form.routeName")}</Label>
              <Input
                id="routeName"
                value={formData.routeName || ""}
                onChange={(e) => handleChange("routeName", e.target.value)}
                placeholder={t("form.routeNamePlaceholder")}
              />
              <p className="text-sm text-muted-foreground">Either Path DSL or Route Name is required</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priority">{t("form.priority")}</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    handleChange("priority", parseInt(e.target.value, 10))
                  }
                />
              </div>

              <div className="flex items-center justify-between pt-6">
                <div className="space-y-0.5">
                  <Label>{t("form.status")}</Label>
                  <p className="text-sm text-muted-foreground">{t("form.statusDescription")}</p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleChange("isActive", checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("form.storeScope")}</CardTitle>
            <CardDescription>{t("form.storeScopeDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="storeScopeMode">{t("form.storeScopeMode")}</Label>
                <Select
                  value={formData.storeScopeMode}
                  onValueChange={(value: string) => handleChange("storeScopeMode", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">none</SelectItem>
                    <SelectItem value="scoped">scoped</SelectItem>
                    <SelectItem value="all_stores">all_stores</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">{t("form.storeScopeModeHint")}</p>
              </div>

              <div className="space-y-2">
                <Label>{t("form.storeIdSources")}</Label>
                <div className="flex gap-4">
                  {["path", "query", "body"].map((src) => (
                    <label key={src} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.storeIdSources?.includes(src)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData((prev) => ({
                            ...prev,
                            storeIdSources: checked
                              ? [...(prev.storeIdSources || []), src]
                              : (prev.storeIdSources || []).filter((s) => s !== src),
                          }));
                        }}
                      />
                      <span className="text-sm text-muted-foreground">{src}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="storeMatchPolicy">{t("form.storeMatchPolicy")}</Label>
                <Select
                  value={formData.storeMatchPolicy}
                  onValueChange={(value: string) => handleChange("storeMatchPolicy", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">all</SelectItem>
                    <SelectItem value="any">any</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-6">
                <div className="space-y-0.5">
                  <Label>{t("form.storeAllowsEmpty")}</Label>
                  <p className="text-sm text-muted-foreground">{t("form.storeAllowsEmptyHint")}</p>
                </div>
                <Switch
                  checked={!!formData.storeAllowsEmpty}
                  onCheckedChange={(checked) => handleChange("storeAllowsEmpty", checked)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t("form.storeAllAccessRolesAny")}</Label>
              <p className="text-sm text-muted-foreground">{t("form.storeAllAccessRolesAnyHint")}</p>
              <div className="flex flex-wrap gap-2">
                {formData.storeAllAccessRolesAny?.map((roleName) => (
                  <Badge key={roleName} variant="secondary">
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
              <Select key={`store-role-select-${storeRoleSelectKey}`} onValueChange={handleAddStoreRole}>
                <SelectTrigger className="w-50">
                  <SelectValue placeholder={t("form.selectRolePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
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

            <div className="space-y-3">
              <Label>{t("form.storeAllAccessPermissionsAny")}</Label>
              <p className="text-sm text-muted-foreground">{t("form.storeAllAccessPermissionsAnyHint")}</p>
              <div className="flex flex-wrap gap-2">
                {formData.storeAllAccessPermissionsAny?.map((permission) => (
                  <Badge key={permission} variant="secondary">
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
              <div className="flex gap-2">
                <Input
                  value={newStorePermission}
                  onChange={(e) => setNewStorePermission(e.target.value)}
                  placeholder={t("form.permissionPlaceholder")}
                  className="w-50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddStorePermission}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("form.authorization")}</CardTitle>
          <CardDescription>
            {t("form.authorizationDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>{t("form.rolesAny")}</Label>
            <p className="text-sm text-muted-foreground">
              {t("form.rolesAnyHint")}
            </p>
            <div className="flex flex-wrap gap-2">
              {formData.rolesAny?.map((roleName) => (
                  <Badge key={roleName} variant="secondary">
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
            <Select key={`role-select-${roleSelectKey}`} onValueChange={handleAddRole}>
              <SelectTrigger className="w-50">
                <SelectValue placeholder={t("form.selectRolePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Label>{t("form.permissionsAny")}</Label>
              <p className="text-sm text-muted-foreground">{t("form.permissionsAnyHint")}</p>
              <div className="flex flex-wrap gap-2">
                {formData.permissionsAny?.map((permission) => (
                  <Badge key={permission} variant="secondary">
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
              <div className="flex gap-2">
                <Input
                  value={newPermissionAny}
                  onChange={(e) => setNewPermissionAny(e.target.value)}
                  placeholder={t("form.selectPermissionPlaceholder")}
                  className="w-50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleAddPermission("permissionsAny")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t("form.permissionsAll")}</Label>
              <p className="text-sm text-muted-foreground">{t("form.permissionsAllHint")}</p>
              <div className="flex flex-wrap gap-2">
                {formData.permissionsAll?.map((permission) => (
                  <Badge key={permission} variant="secondary">
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
              <div className="flex gap-2">
                <Input
                  value={newPermissionAll}
                  onChange={(e) => setNewPermissionAll(e.target.value)}
                  placeholder={t("form.selectPermissionPlaceholder")}
                  className="w-50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleAddPermission("permissionsAll")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
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
