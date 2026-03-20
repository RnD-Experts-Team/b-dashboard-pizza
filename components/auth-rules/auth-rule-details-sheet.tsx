"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAuthRuleDetail } from "@/lib/hooks/use-auth-rule-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Loader2,
  RefreshCw,
  ShieldCheck,
  User,
} from "lucide-react";
import type { AuthRule, HttpMethod } from "@/types/auth-rule.types";

const METHOD_BADGE_CLASSNAMES: Record<HttpMethod, string> = {
  GET: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  POST: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  PUT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  PATCH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  ANY: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "MMM dd, yyyy HH:mm");
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[12rem_1fr] sm:gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="wrap-break-word font-medium">{value}</div>
    </div>
  );
}

function renderTagList(values: string[] | null | undefined, variant: "outline" | "secondary" | "default") {
  if (!values || values.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <Badge key={value} variant={variant}>
          {value}
        </Badge>
      ))}
    </div>
  );
}

function AuthRuleDetailsContent({ detail }: { detail: AuthRule }) {
  const t = useTranslations("authRules");
  const method = (detail.method || detail.httpMethod || "GET") as HttpMethod;
  const storeScopeMode = detail.storeScopeMode ?? detail.store_scope_mode ?? "none";
  const isScoped = storeScopeMode === "scoped";
  const storeScopeModeLabel = useMemo(() => {
    if (storeScopeMode === "none") return t("form.storeScopeModes.none");
    if (storeScopeMode === "scoped") return t("form.storeScopeModes.scoped");
    if (storeScopeMode === "all_stores") return t("form.storeScopeModes.allStores");
    return storeScopeMode;
  }, [storeScopeMode, t]);

  const rolesAny = detail.rolesAny ?? detail.roles_any;
  const permissionsAny = detail.permissionsAny ?? detail.permissions_any;
  const permissionsAll = detail.permissionsAll ?? detail.permissions_all;
  const storeIdSources = detail.storeIdSources ?? detail.store_id_sources;
  const storeMatchPolicy = detail.storeMatchPolicy ?? detail.store_match_policy;
  const storeAllowsEmpty = detail.storeAllowsEmpty ?? detail.store_allows_empty ?? false;
  const storeAllAccessRolesAny =
    detail.storeAllAccessRolesAny ?? detail.store_all_access_roles_any;
  const storeAllAccessPermissionsAny =
    detail.storeAllAccessPermissionsAny ?? detail.store_all_access_permissions_any;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4">
        <Badge className={cn("gap-1", METHOD_BADGE_CLASSNAMES[method] || "")}>{method}</Badge>
        <Badge variant={detail.isActive ? "default" : "secondary"}>
          {detail.isActive ? t("status.active") : t("status.inactive")}
        </Badge>
        <Badge variant="secondary">{detail.service || "-"}</Badge>
      </div>

      <Separator className="my-3" />

      <ScrollArea className="h-[calc(100vh-15.5rem)] px-4 pb-6 sm:h-[calc(100vh-14rem)]">
        <div className="space-y-5">
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Route
            </h4>
            <div className="space-y-2 rounded-lg border p-3">
              <DetailRow label={t("form.service")} value={detail.service || "-"} />
              <DetailRow
                label={t("form.httpMethod")}
                value={<Badge className={METHOD_BADGE_CLASSNAMES[method] || ""}>{method}</Badge>}
              />
              <DetailRow
                label={t("form.pathDsl")}
                value={<code className="rounded bg-muted px-2 py-1 text-sm">{detail.pathDsl || "-"}</code>}
              />
              <DetailRow
                label="Path Regex"
                value={<code className="rounded bg-muted px-2 py-1 text-sm">{detail.pathRegex || detail.path_regex || "-"}</code>}
              />
              <DetailRow label={t("form.routeName")} value={detail.routeName || detail.route_name || "-"} />
              <DetailRow label={t("form.priority")} value={detail.priority} />
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("form.authorization")}
            </h4>
            <div className="space-y-3 rounded-lg border p-3">
              <DetailRow
                label={t("form.rolesAny")}
                value={renderTagList(rolesAny, "outline")}
              />
              <DetailRow
                label={t("form.permissionsAny")}
                value={renderTagList(permissionsAny, "secondary")}
              />
              <DetailRow
                label={t("form.permissionsAll")}
                value={renderTagList(permissionsAll, "default")}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("form.storeScope")}
            </h4>
            <div className="space-y-2 rounded-lg border p-3">
              <DetailRow label={t("form.storeScopeMode")} value={storeScopeModeLabel} />
              <DetailRow
                label={t("columns.scoped")}
                value={isScoped ? t("scoped.true") : t("scoped.false")}
              />
              <DetailRow
                label={t("form.storeIdSources")}
                value={
                  storeIdSources && storeIdSources.length > 0
                    ? storeIdSources.join(", ")
                    : "-"
                }
              />
              <DetailRow label={t("form.storeMatchPolicy")} value={storeMatchPolicy || "-"} />
              <DetailRow
                label={t("form.storeAllowsEmpty")}
                value={storeAllowsEmpty ? t("scoped.true") : t("scoped.false")}
              />
              <DetailRow
                label={t("form.storeAllAccessRolesAny")}
                value={renderTagList(storeAllAccessRolesAny, "outline")}
              />
              <DetailRow
                label={t("form.storeAllAccessPermissionsAny")}
                value={renderTagList(storeAllAccessPermissionsAny, "secondary")}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Metadata
            </h4>
            <div className="space-y-2 rounded-lg border p-3">
              <DetailRow label="Rule ID" value={String(detail.id)} />
              <DetailRow
                label={t("columns.createdAt")}
                value={formatDateTime(detail.createdAt || detail.created_at)}
              />
              <DetailRow
                label="Updated At"
                value={formatDateTime(detail.updatedAt || detail.updated_at)}
              />
            </div>
          </section>
        </div>
      </ScrollArea>
    </>
  );
}

interface AuthRuleDetailsSheetProps {
  ruleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthRuleDetailsSheet({
  ruleId,
  open,
  onOpenChange,
}: AuthRuleDetailsSheetProps) {
  const activeRuleId = open ? ruleId : null;
  const { detail, isLoading, error, refetch } = useAuthRuleDetail(activeRuleId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-xl md:max-w-2xl">
        <SheetHeader className="border-b pb-3">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Auth Rule Details
          </SheetTitle>
          <SheetDescription>
            {detail
              ? `${detail.service || "Rule"} #${detail.id}`
              : ruleId
                ? `Rule #${ruleId}`
                : "Auth rule details"}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading auth rule details...
          </div>
        ) : error ? (
          <div className="space-y-3 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch} className="w-fit">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : detail ? (
          <AuthRuleDetailsContent detail={detail} />
        ) : (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            No details available.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
