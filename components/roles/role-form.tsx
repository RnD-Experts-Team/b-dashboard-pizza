"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, AlertCircle, Shield } from "lucide-react";
import { useCreateRole, useUpdateRole, usePermissions, useRoleDetails } from "@/lib/hooks/use-roles";
import type { Role, Permission, CreateRolePayload, UpdateRolePayload } from "@/types/role.types";

interface RoleFormProps {
  roleId?: string;
  onSuccess?: (role: Role) => void;
}

export function RoleForm({ roleId, onSuccess }: RoleFormProps) {
  const t = useTranslations("roles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const isEditMode = Boolean(roleId);
  
  // Hooks for CRUD operations
  const { createRole, isCreating, error: createError } = useCreateRole();
  const { updateRole, syncPermissions, isUpdating, error: updateError } = useUpdateRole();
  const { role: existingRole, isLoading: isLoadingRole, fetchRole } = useRoleDetails(roleId || "");
  const { permissions, isLoading: isLoadingPermissions } = usePermissions();

  // API expects permission names, not IDs
  const [formData, setFormData] = useState<CreateRolePayload>({
    name: "",
    guardName: "web",
    permissions: [],
  });

  // Load role data when in edit mode
  useEffect(() => {
    if (roleId) {
      fetchRole();
    }
  }, [roleId, fetchRole]);

  // Populate form when role data is loaded
  useEffect(() => {
    if (existingRole && isEditMode) {
      setFormData({
        name: existingRole.name,
        guardName: existingRole.guardName || "web",
        permissions: existingRole.permissions?.map((p) => p.name) || [],
      });
    }
  }, [existingRole, isEditMode]);

  const error = isEditMode ? updateError : createError;
  const isSubmitting = isEditMode ? isUpdating : isCreating;

  const handleChange = (field: keyof CreateRolePayload, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePermissionToggle = (permissionName: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions?.includes(permissionName)
        ? prev.permissions.filter((name) => name !== permissionName)
        : [...(prev.permissions || []), permissionName],
    }));
  };

  const handleSelectAll = () => {
    setFormData((prev) => ({
      ...prev,
      permissions: (permissions || []).map((p) => p.name),
    }));
  };

  const handleDeselectAll = () => {
    setFormData((prev) => ({
      ...prev,
      permissions: [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let result: Role;
      
      if (isEditMode && roleId) {
        // Update existing role
        const updatePayload: UpdateRolePayload = {
          name: formData.name,
        };
        result = await updateRole(roleId, updatePayload);
        
        // Sync permissions separately
        if (formData.permissions) {
          await syncPermissions(roleId, formData.permissions);
        }
      } else {
        // Create new role
        result = await createRole(formData);
      }
      
      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/${locale}/dashboard/roles`);
      }
    } catch {
      // Error is handled by the hooks
    }
  };

  // Show loading skeleton while fetching role data in edit mode
  if (isEditMode && isLoadingRole) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group permissions by category (based on name prefix)
  const groupedPermissions = (permissions || []).reduce(
    (acc, permission) => {
      const parts = permission.name.split(".");
      const category = parts.length > 1 ? parts[0] : "general";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(permission);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("form.basicInfo")}</CardTitle>
          <CardDescription>{t("form.basicInfoDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("form.name")}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder={t("form.namePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guardName">{t("form.guardName")}</Label>
            <Input
              id="guardName"
              value={formData.guardName}
              onChange={(e) => handleChange("guardName", e.target.value)}
              placeholder={t("form.guardNamePlaceholder")}
            />
            <p className="text-sm text-muted-foreground">
              {t("form.guardNameHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t("form.permissions")}</CardTitle>
              <CardDescription>
                {t("form.permissionsDescription")}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="flex-1 sm:flex-none"
              >
                {t("form.selectAll")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
                className="flex-1 sm:flex-none"
              >
                {t("form.deselectAll")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPermissions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-100 pr-4">
              <div className="space-y-6">
                {Object.entries(groupedPermissions).map(
                  ([category, perms]) => (
                    <div key={category} className="space-y-3">
                      <h4 className="flex items-center gap-2 font-medium capitalize">
                        <Shield className="h-4 w-4" />
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {perms.map((permission) => (
                          <div
                            key={permission.id}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={permission.id}
                              checked={formData.permissions?.includes(
                                permission.name
                              )}
                              onCheckedChange={() =>
                                handlePermissionToggle(permission.name)
                              }
                            />
                            <Label
                              htmlFor={permission.id}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {permission.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${locale}/dashboard/roles`)}
          className="flex-1 sm:flex-none"
        >
          {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none">
          {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {isEditMode ? tCommon("save") : t("form.create")}
        </Button>
      </div>
    </form>
  );
}
