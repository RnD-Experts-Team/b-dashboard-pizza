"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { UserForm } from "@/components/users";

export default function CreateUserPage() {
  const t = useTranslations("users");

  return (
    <div className="space-y-6 pb-2">
      <PageHeader title={t("create.title")} description={t("create.description")} />
      <UserForm mode="create" />
    </div>
  );
}
