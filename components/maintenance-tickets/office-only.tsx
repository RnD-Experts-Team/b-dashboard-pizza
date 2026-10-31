"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth/auth.store";

/**
 * The maintenance office's pages (Trips, Payments, Storage, Technicians &
 * Suppliers): the sidebar already hides them from a store manager, and this
 * keeps a typed or bookmarked URL from opening a page of "Forbidden" errors.
 * Gated on the page's own read rule (`GET path`, no store). Until the auth
 * rules have loaded nothing is decided, so the page renders as it would.
 */
export function OfficeOnly({ path, children }: { path: string; children: ReactNode }) {
  const t = useTranslations("maintenanceSystem");
  const rulesLoaded = useAuthStore((s) => s.authRules.length > 0);
  const allowed = useAuthStore((s) => s.canAccessRoute({ service: "Maintenance", method: "GET", path }));

  if (!rulesLoaded || allowed) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-heading text-base font-semibold">{t("common.officeOnlyTitle")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{t("common.officeOnlyBody")}</p>
    </div>
  );
}
