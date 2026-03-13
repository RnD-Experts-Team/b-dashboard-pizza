import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";

/**
 * Locale-aware 404 page.
 * Catches notFound() calls inside app/[locale]/** — e.g. navigating
 * to /en/nonexistent-page or /ar/dashboard/bad-segment.
 * The locale layout has already run at this point, providing html/body,
 * i18n providers, and theme setup, so we only render page content here.
 */
export default async function LocaleNotFound() {
  const locale = await getLocale();
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-8xl font-bold text-primary leading-none">
      </p>

      <h1 className="text-2xl font-semibold tracking-tight">
        {t("title")}
      </h1>

      <p className="text-sm text-muted-foreground max-w-[36ch]">
        {t("description")}
      </p>

      <Button asChild className="mt-2">
        <Link href={`/${locale}/dashboard`}>{t("backToDashboard")}</Link>
      </Button>
    </div>
  );
}
