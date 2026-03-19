"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthRuleDetails } from "@/lib/hooks/use-auth-rules";
import {
  ShieldCheck,
  Route,
  Calendar,
  Pencil,
  ArrowLeft,
  Key,
  Shield,
} from "lucide-react";

const HTTP_METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-100 text-green-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-yellow-100 text-yellow-700",
  PATCH: "bg-orange-100 text-orange-700",
  DELETE: "bg-red-100 text-red-700",
  ANY: "bg-purple-100 text-purple-700",
};

export default function AuthRuleDetailsPage() {
  const t = useTranslations("authRules");
  const tCommon = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const ruleId = params?.id as string;

  const { authRule, isLoading, fetchAuthRule } = useAuthRuleDetails(ruleId);

  useEffect(() => {
    if (ruleId) {
      fetchAuthRule();
    }
  }, [ruleId, fetchAuthRule]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!authRule) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <ShieldCheck className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">{t("noRules")}</p>
        <Button onClick={() => router.push(`/${locale}/dashboard/auth-rules`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tCommon("cancel")}
        </Button>
      </div>
    );
  }

  const storeScopeMode = authRule.storeScopeMode ?? authRule.store_scope_mode ?? "none";
  const storeScopeLabelMap: Record<string, string> = {
    none: t("form.storeScopeModes.none"),
    scoped: t("form.storeScopeModes.scoped"),
    all_stores: t("form.storeScopeModes.allStores"),
  };
  const storeScopeModeLabel = storeScopeLabelMap[storeScopeMode] ?? storeScopeMode;
  const isScoped = storeScopeMode === "scoped";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rule Details"
        description={`${authRule.service || authRule.routeName || "Auth Rule"} — ID: ${authRule.id}`}
      >
        <Button
          variant="outline"
          onClick={() => router.push(`/${locale}/dashboard/auth-rules`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tCommon("cancel")}
        </Button>
        <Button
          onClick={() =>
            router.push(`/${locale}/dashboard/auth-rules/${authRule.id}/edit`)
          }
        >
          <Pencil className="h-4 w-4 mr-2" />
          {t("actions.edit")}
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              {t("form.routeInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("form.service")}
              </span>
              <Badge variant="outline">{authRule.service}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("form.routeName")}
              </span>
              <span className="font-medium">{authRule.routeName || "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("form.httpMethod")}
              </span>
              <Badge
                className={
                  HTTP_METHOD_COLORS[authRule.method || authRule.httpMethod || "GET"] || "bg-gray-100"
                }
              >
                {authRule.method || authRule.httpMethod}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("form.pathDsl")}
              </span>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {authRule.pathDsl || "-"}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("form.storeScopeMode")}
              </span>
              <Badge variant="outline">{storeScopeModeLabel}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("columns.scoped")}
              </span>
              <Badge variant={isScoped ? "default" : "secondary"}>
                {isScoped ? t("scoped.true") : t("scoped.false")}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("form.priority")}
              </span>
              <span className="font-medium">{authRule.priority}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("columns.status")}
              </span>
              <Badge variant={authRule.isActive ? "default" : "secondary"}>
                {authRule.isActive ? t("status.active") : t("status.inactive")}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("columns.createdAt")}
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {authRule.createdAt
                  ? new Date(authRule.createdAt).toLocaleDateString()
                  : "-"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              {t("form.authorization")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {authRule.rolesAny && authRule.rolesAny.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t("form.rolesAny")}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {authRule.rolesAny.map((role: string) => (
                    <Badge key={role} variant="outline">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {authRule.permissionsAny && authRule.permissionsAny.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {t("form.permissionsAny")}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {authRule.permissionsAny.map((perm: string) => (
                    <Badge key={perm} variant="secondary">
                      {perm}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {authRule.permissionsAll && authRule.permissionsAll.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {t("form.permissionsAll")}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {authRule.permissionsAll.map((perm: string) => (
                    <Badge key={perm}>{perm}</Badge>
                  ))}
                </div>
              </div>
            )}

            {(!authRule.rolesAny || authRule.rolesAny.length === 0) &&
              (!authRule.permissionsAny ||
                authRule.permissionsAny.length === 0) &&
              (!authRule.permissionsAll ||
                authRule.permissionsAll.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No authorization rules configured
                </p>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
