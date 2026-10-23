"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillsCatalog } from "@/components/skills/skills-catalog";
import { SkillsOverview } from "@/components/skills/skills-overview";

/**
 * Employee skills: the picked stores' employees against every skill (rated in
 * place), and the shared skills list.
 */
export default function SkillsPage() {
  const t = useTranslations("skills");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs defaultValue="overview">
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            <TabsTrigger value="overview">{t("overviewTab")}</TabsTrigger>
            <TabsTrigger value="list">{t("listTab")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4" tabIndex={-1}>
          <SkillsOverview />
        </TabsContent>

        <TabsContent value="list" className="mt-4" tabIndex={-1}>
          <SkillsCatalog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
