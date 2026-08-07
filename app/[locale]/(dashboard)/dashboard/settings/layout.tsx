"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Separator } from "@/components/ui/separator";
import { useFeature } from "@/lib/config";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("settings");
  const pathname = usePathname();
  const params = useParams();
  const locale = params?.locale as string || "en";

  // Check feature flags for settings tabs
  const darkModeEnabled = useFeature("darkMode");
  const themeSystemEnabled = useFeature("themeSystem");
  const localizationEnabled = useFeature("localization");
  const soundFxEnabled = useFeature("soundFx");

  // Build settings tabs based on enabled features
  const settingsTabs = [
    { value: "profile", label: t("tabs.profile"), href: `/${locale}/dashboard/settings/profile`, enabled: true },
    // { value: "account", label: t("tabs.account"), href: `/${locale}/dashboard/settings/account`, enabled: true },
    // { value: "appearance", label: t("tabs.appearance"), href: `/${locale}/dashboard/settings/appearance`, enabled: darkModeEnabled },
    // { value: "preferences", label: t("tabs.preferences"), href: `/${locale}/dashboard/settings/preferences`, enabled: localizationEnabled },
    { value: "themes", label: t("tabs.themes"), href: `/${locale}/dashboard/settings/themes`, enabled: themeSystemEnabled },
    { value: "sound", label: t("tabs.sound"), href: `/${locale}/dashboard/settings/sound`, enabled: soundFxEnabled },
  ].filter(tab => tab.enabled);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />

      <Separator />

      <div className="flex flex-col space-y-8 lg:flex-row lg:space-y-0 lg:gap-12">
        <aside className="lg:w-1/5">
          <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 overflow-x-auto">
            {settingsTabs.map((tab) => {
              const isActive = pathname === tab.href || pathname.endsWith(tab.value);
              return (
                <Link
                  key={tab.value}
                  href={tab.href}
                  className={cn(
                    "inline-flex items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex-1 lg:max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
