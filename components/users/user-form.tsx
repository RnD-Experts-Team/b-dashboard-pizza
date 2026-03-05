"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertCircle, Eye, EyeOff, Shield, Lock } from "lucide-react";
import { useRoles } from "@/lib/hooks/use-roles";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { useUsersStore } from "@/lib/store/users.store";
import type { CreateUserPayload, UpdateUserPayload, User } from "@/types/user.types";

interface UserFormValues {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  roles: string[];
  permissions: string[];
}

interface ApiValidationErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
}

const cancelErrorPattern = /cancel(?:ed|led)|abort(?:ed|error)?/i;

function isCanceledError(error: unknown): boolean {
  if (axios.isCancel(error)) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (
    error instanceof Error &&
    (error.name === "CanceledError" || cancelErrorPattern.test(error.message))
  ) {
    return true;
  }
  if (typeof error === "string") {
    return cancelErrorPattern.test(error);
  }
  return false;
}

function isDisplayableErrorMessage(message: string | null | undefined): message is string {
  return Boolean(message && !cancelErrorPattern.test(message));
}

function isSuperAdminRole(roleName: string): boolean {
  return roleName.toLowerCase().replace(/[\s_-]+/g, "") === "superadmin";
}

function buildUserFormSchema(
  t: ReturnType<typeof useTranslations>,
  isEditMode: boolean
) {
  return z
    .object({
      name: z.string().trim().min(1, t("form.validation.nameRequired")),
      email: z
        .string()
        .trim()
        .min(1, t("form.validation.emailRequired"))
        .email(t("form.validation.emailInvalid")),
      password: z.string(),
      passwordConfirmation: z.string(),
      roles: z.array(z.string()),
      permissions: z.array(z.string()),
    })
    .superRefine((data, ctx) => {
      const hasPassword = data.password.trim().length > 0;
      const hasPasswordConfirmation = data.passwordConfirmation.trim().length > 0;

      if (!isEditMode || hasPassword || hasPasswordConfirmation) {
        if (!hasPassword) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["password"],
            message: t("form.validation.passwordRequired"),
          });
        } else if (data.password.length < 8) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["password"],
            message: t("form.validation.passwordMinLength"),
          });
        }

        if (!hasPasswordConfirmation || data.password !== data.passwordConfirmation) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["passwordConfirmation"],
            message: t("form.validation.passwordMismatch"),
          });
        }
      }
    });
}

function extractFormError(
  error: unknown,
  fallbackMessage: string
): {
  message: string;
  fieldErrors: Partial<Record<keyof UserFormValues, string>>;
} {
  const fieldErrors: Partial<Record<keyof UserFormValues, string>> = {};

  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as ApiValidationErrorResponse | undefined;

    if (payload?.errors) {
      for (const [fieldKey, messages] of Object.entries(payload.errors)) {
        const firstMessage = messages[0];
        if (!firstMessage) continue;

        if (fieldKey === "name") fieldErrors.name = firstMessage;
        if (fieldKey === "email") fieldErrors.email = firstMessage;
        if (fieldKey === "password") fieldErrors.password = firstMessage;
        if (fieldKey === "password_confirmation" || fieldKey === "passwordConfirmation") {
          fieldErrors.passwordConfirmation = firstMessage;
        }
      }
    }

    if (payload?.message) {
      return {
        message: payload.message,
        fieldErrors,
      };
    }

    if (error.message) {
      return {
        message: error.message,
        fieldErrors,
      };
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      fieldErrors,
    };
  }

  return {
    message: fallbackMessage,
    fieldErrors,
  };
}

interface UserFormProps {
  mode?: "create" | "edit";
  user?: User;
  userId?: string;
  onSuccess?: (user: User) => void;
  onCancel?: () => void;
}

export function UserForm({
  mode = "create",
  user,
  userId,
  onSuccess,
  onCancel,
}: UserFormProps) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const isEditMode = mode === "edit";
  const effectiveUserId = userId ?? user?.id ?? null;

  const createUser = useUsersStore((state) => state.createUser);
  const updateUser = useUsersStore((state) => state.updateUser);
  const isCreating = useUsersStore((state) => state.isCreating);
  const isUpdating = useUsersStore((state) => state.isUpdating);
  const createError = useUsersStore((state) => state.createError);
  const updateError = useUsersStore((state) => state.updateError);
  const clearErrors = useUsersStore((state) => state.clearErrors);

  // Fetch all roles and permissions (use large perPage to get all in one page)
  const rolesParams = useMemo(() => ({ perPage: 100 }), []);
  const { roles, isLoading: isLoadingRoles, error: rolesError } = useRoles(rolesParams);
  const {
    permissions,
    isLoading: isLoadingPermissions,
    error: permissionsError,
  } = usePermissions({ perPage: 100 });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo<UserFormValues>(
    () => ({
      name: user?.name ?? "",
      email: user?.email ?? "",
      password: "",
      passwordConfirmation: "",
      roles: user?.roles?.map((role) => role.name) ?? [],
      permissions: user?.permissions?.map((permission) => permission.name) ?? [],
    }),
    [user]
  );

  const schema = useMemo(() => buildUserFormSchema(t, isEditMode), [t, isEditMode]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const selectedRoles = form.watch("roles");
  const selectedPermissions = form.watch("permissions");

  const isSuperAdminSelected = useMemo(
    () => selectedRoles.some((roleName) => isSuperAdminRole(roleName)),
    [selectedRoles]
  );

  const actionError = isEditMode ? updateError : createError;
  const visibleRoleError = isDisplayableErrorMessage(rolesError) ? rolesError : null;
  const visiblePermissionError = isDisplayableErrorMessage(permissionsError)
    ? permissionsError
    : null;
  const visibleActionError = isDisplayableErrorMessage(actionError) ? actionError : null;
  const visibleSubmitError = submitError ?? visibleActionError;
  const isSubmitting = isEditMode ? isUpdating : isCreating;

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    clearErrors();
    return () => clearErrors();
  }, [clearErrors]);

  useEffect(() => {
    if (!permissions || permissions.length === 0) return;
    if (!isSuperAdminSelected) return;

    const allPermissionNames = permissions.map((permission) => permission.name);
    const currentPermissionNames = form.getValues("permissions");
    const isSamePermissionSet =
      allPermissionNames.length === currentPermissionNames.length &&
      allPermissionNames.every((permissionName) =>
        currentPermissionNames.includes(permissionName)
      );

    if (isSamePermissionSet) return;

    form.setValue("permissions", allPermissionNames, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [permissions, form, isSuperAdminSelected]);

  const handleRoleChange = (checked: boolean, roleName: string) => {
    const currentRoles = form.getValues("roles");
    const roleSet = new Set(currentRoles);

    if (checked) {
      roleSet.add(roleName);
    } else {
      roleSet.delete(roleName);
    }

    form.setValue("roles", Array.from(roleSet), {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (!permissions || !isSuperAdminRole(roleName)) {
      return;
    }

    const nextPermissions = checked ? permissions.map((permission) => permission.name) : [];
    form.setValue("permissions", nextPermissions, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handlePermissionChange = (checked: boolean, permissionName: string) => {
    const currentPermissions = form.getValues("permissions");
    const permissionSet = new Set(currentPermissions);

    if (checked) {
      permissionSet.add(permissionName);
    } else {
      permissionSet.delete(permissionName);
    }

    form.setValue("permissions", Array.from(permissionSet), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }

    if (isEditMode && effectiveUserId) {
      router.push(`/${locale}/dashboard/users/${effectiveUserId}`);
      return;
    }

    router.push(`/${locale}/dashboard/users`);
  };

  const onSubmit = async (values: UserFormValues) => {
    setSubmitError(null);
    clearErrors();

    const cleanRoles = Array.from(new Set(values.roles));
    const cleanPermissions = Array.from(new Set(values.permissions));

    try {
      let savedUser: User;

      if (isEditMode) {
        if (!effectiveUserId) {
          setSubmitError(t("edit.notFound"));
          return;
        }

        const payload: UpdateUserPayload = {
          name: values.name.trim(),
          email: values.email.trim(),
          roles: cleanRoles,
          permissions: cleanPermissions,
        };

        if (values.password.trim().length > 0) {
          payload.password = values.password;
          payload.passwordConfirmation = values.passwordConfirmation;
        }

        savedUser = await updateUser(effectiveUserId, payload);
      } else {
        const payload: CreateUserPayload = {
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          passwordConfirmation: values.passwordConfirmation,
          roles: cleanRoles,
          permissions: cleanPermissions,
        };

        savedUser = await createUser(payload);
      }

      if (onSuccess) {
        onSuccess(savedUser);
        return;
      }

      if (isEditMode) {
        router.push(`/${locale}/dashboard/users/${savedUser.id}`);
      } else {
        router.push(`/${locale}/dashboard/users`);
      }
    } catch (error) {
      if (isCanceledError(error)) {
        return;
      }

      const fallbackMessage = isEditMode ? t("edit.updateError") : tCommon("error");
      const { message, fieldErrors } = extractFormError(error, fallbackMessage);

      for (const [field, fieldErrorMessage] of Object.entries(fieldErrors)) {
        form.setError(field as keyof UserFormValues, {
          type: "server",
          message: fieldErrorMessage,
        });
      }

      if (isDisplayableErrorMessage(message)) {
        setSubmitError(message);
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {visibleSubmitError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{visibleSubmitError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("form.basicInfo")}</CardTitle>
              <CardDescription>{t("form.basicInfoDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.name")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("form.namePlaceholder")}
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("form.emailPlaceholder")}
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("form.security")}</CardTitle>
              <CardDescription>{t("form.securityDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.password")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder={
                            isEditMode
                              ? t("edit.passwordPlaceholder")
                              : t("form.passwordPlaceholder")
                          }
                          className="pe-10"
                          disabled={isSubmitting}
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute inset-y-0 end-0 h-full px-3"
                          onClick={() => setShowPassword((prev) => !prev)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    {isEditMode && (
                      <FormDescription>{t("edit.passwordDescription")}</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="passwordConfirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.confirmPassword")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder={
                            isEditMode
                              ? t("edit.confirmPasswordPlaceholder")
                              : t("form.confirmPasswordPlaceholder")
                          }
                          className="pe-10"
                          disabled={isSubmitting}
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute inset-y-0 end-0 h-full px-3"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t("form.assignRoles")}
              </CardTitle>
              <CardDescription>{t("form.assignRolesDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {visibleRoleError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{visibleRoleError}</AlertDescription>
                </Alert>
              )}

              {isLoadingRoles ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : roles && roles.length > 0 ? (
                <div className="space-y-3">
                  {roles.map((role) => {
                    const rolePermissions = role.permissions?.map((permission) => permission.name) ?? [];
                    const roleChecked = selectedRoles.includes(role.name);
                    const roleIsSuperAdmin = isSuperAdminRole(role.name);

                    return (
                      <div
                        key={role.id}
                        className="rounded-lg border border-input p-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`role-${role.id}`}
                            checked={roleChecked}
                            disabled={isSubmitting}
                            onCheckedChange={(checked) => {
                              handleRoleChange(Boolean(checked), role.name);
                            }}
                            className="mt-0.5"
                          />
                          <label htmlFor={`role-${role.id}`} className="min-w-0 flex-1 cursor-pointer">
                            <p className="text-sm font-medium leading-none">{role.name}</p>
                            {roleIsSuperAdmin ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                ({t("form.allPermissions")})
                              </p>
                            ) : rolePermissions.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {rolePermissions.map((permissionName) => (
                                  <Badge
                                    key={`${role.id}-${permissionName}`}
                                    variant="secondary"
                                    className="max-w-full text-[11px] font-normal"
                                  >
                                    <span className="truncate">{permissionName}</span>
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {t("form.noRolePermissions")}
                              </p>
                            )}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("form.noRolesAvailable")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                {t("form.additionalPermissions")}
              </CardTitle>
              <CardDescription>{t("form.additionalPermissionsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {visiblePermissionError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{visiblePermissionError}</AlertDescription>
                </Alert>
              )}

              {isSuperAdminSelected && (
                <Alert className="mb-4">
                  <AlertDescription>{t("form.superAdminPermissionsInherited")}</AlertDescription>
                </Alert>
              )}

              {isLoadingPermissions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : permissions && permissions.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {permissions.map((permission) => {
                    const checked = selectedPermissions.includes(permission.name);

                    return (
                      <div
                        key={permission.id}
                        className="flex items-start gap-3 rounded-lg border border-input p-3 transition-colors hover:bg-muted/40"
                      >
                        <Checkbox
                          id={`permission-${permission.id}`}
                          checked={checked}
                          disabled={isSubmitting || isSuperAdminSelected}
                          onCheckedChange={(nextChecked) => {
                            handlePermissionChange(Boolean(nextChecked), permission.name);
                          }}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor={`permission-${permission.id}`}
                          className="min-w-0 flex-1 cursor-pointer text-sm font-medium leading-tight"
                        >
                          {permission.name}
                        </label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("form.noPermissionsAvailable")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {tCommon("cancel")}
          </Button>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {isEditMode ? t("edit.saveChanges") : t("createUser")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
