"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { ScreenProjectView } from "@/components/screen-project";

export default function ScreenProjectPage() {
  const t = useTranslations("screenProject");

  return (
    /*
     * The outer div uses flex-col so the PageHeader sits at the top and the
     * video area fills the remaining viewport height via flex-1 + min-h-0.
     * calc(100svh - 10rem) gives a sensible floor across all layout variants
     * (topbar ~56px + py padding ~48px + page header ~72px ≈ 176px ≈ 11rem).
     */
    <div className="flex flex-col gap-4 h-[calc(100svh-6.5rem)] min-h-120">
      {/* <PageHeader
        title={t("title")}
        description={t("description")}
      /> */}
      <div className="flex-1 min-h-0">
        <ScreenProjectView />
      </div>
    </div>
  );
}
