"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { EditCameraForm } from "@/components/qa/edit-camera-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EditCameraFormPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const formId = Number(params?.id);
  const t = useTranslations("editCameraForm");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${locale}/dashboard/quality-assurance`}>
            <ArrowLeft className="me-2 h-4 w-4" />
            {t("back")}
          </Link>
        </Button>
      </PageHeader>
      <EditCameraForm formId={formId} />
    </div>
  );
}
