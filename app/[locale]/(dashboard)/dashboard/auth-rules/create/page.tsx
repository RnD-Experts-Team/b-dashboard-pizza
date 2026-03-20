"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { AuthRuleForm } from "@/components/auth-rules";

export default function CreateAuthRulePage() {
  const t = useTranslations("authRules");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 sm:space-y-4">
      <PageHeader
        title={t("create.title")}
        description={t("create.description")}
        className="gap-2 sm:gap-3"
      />
      <AuthRuleForm />
    </div>
  );
}
