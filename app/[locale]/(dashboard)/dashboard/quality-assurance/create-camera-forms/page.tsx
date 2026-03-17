"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { CameraForm } from "@/components/qa/camera-form";

export default function CreateCameraFormsPage() {
  const t = useTranslations("createCameraForm");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <CameraForm />
    </div>
  );
}
