"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Script from "next/script";
import { useAuthStore } from "@/lib/auth/auth.store";
import { AppShell } from "@/components/layout/app-shell";
// import { AnnouncementPopup } from "@/components/announcements/announcement-popup";
import { AnnouncementOnLoadPopup } from "@/components/announcements/announcement-onload-popup";
import { PizzaLoader } from "@/components/shared/pizza-loader";
import { ReportProblemRoot } from "@/components/report-problem";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string || "en";
  const { isAuthenticated, isInitialized, isLoading, initialize, checkAuth } = useAuthStore();

  useEffect(() => {
    initialize();
    checkAuth();
  }, [initialize, checkAuth]);

  useEffect(() => {
    if (isInitialized && !isLoading && !isAuthenticated) {
      router.push(`/${locale}/auth/login`);
    }
  }, [isInitialized, isLoading, isAuthenticated, router, locale]);

  // Show nothing while checking auth
  if (!isInitialized || isLoading || !isAuthenticated) {
    return <PizzaLoader />;
  }

  return (
    <>
      <AppShell>{children}</AppShell>
      {/* <AnnouncementPopup /> */}
      <AnnouncementOnLoadPopup />
      <ReportProblemRoot />
      {/* Chat widget (rdexperts). Remove this <Script> + CHAT_WIDGET_ORIGIN in next.config.ts to drop it. */}
      {/* <Script
        src="https://chat.rdexperts.tech/w/wk_xyg50sd4c3kv4h25lnkg.js"
        strategy="afterInteractive"
        async
      /> */}
    </>
  );
}
