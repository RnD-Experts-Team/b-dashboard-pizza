"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth/auth.store";
import { AppShell } from "@/components/layout/app-shell";
import { AnnouncementPopup } from "@/components/announcements/announcement-popup";
import { AnnouncementOnLoadPopup } from "@/components/announcements/announcement-onload-popup";

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
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <AppShell>{children}</AppShell>
      <AnnouncementPopup />
      <AnnouncementOnLoadPopup />
    </>
  );
}
