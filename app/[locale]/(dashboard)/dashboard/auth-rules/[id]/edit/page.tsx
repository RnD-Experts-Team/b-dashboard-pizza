"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { AuthRuleForm } from "@/components/auth-rules";
import { useAuthRuleDetails } from "@/lib/hooks/use-auth-rules";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck } from "lucide-react";

export default function EditAuthRulePage() {
  const t = useTranslations("authRules");
  const params = useParams();
  const rawRuleId = params?.id;
  const ruleId = Array.isArray(rawRuleId) ? rawRuleId[0] : rawRuleId;

  const { authRule, isLoading, fetchAuthRule } = useAuthRuleDetails(ruleId);
  const isRuleMismatch =
    !!authRule && !!ruleId && String(authRule.id) !== String(ruleId);

  useEffect(() => {
    if (ruleId) {
      fetchAuthRule();
    }
  }, [ruleId, fetchAuthRule]);

  if (isLoading || isRuleMismatch) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-3 sm:space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52 sm:h-8" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-130 w-full" />
      </div>
    );
  }

  if (!authRule || !ruleId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4">
        <ShieldCheck className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">{t("noRules")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 sm:space-y-4">
      <PageHeader
        title={t("edit.title")}
        description={t("edit.description")}
        className="gap-2 sm:gap-3"
      />
      <AuthRuleForm rule={authRule} mode="edit" />
    </div>
  );
}
