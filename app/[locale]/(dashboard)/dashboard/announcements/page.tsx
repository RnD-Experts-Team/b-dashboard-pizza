"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Shield, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnouncementAdminList } from "@/components/announcements/admin/announcement-admin-list";
import type { ComposerMode } from "@/components/announcements/composer/announcement-composer-dialog";
import { AnnouncementFeed } from "@/components/announcements/feed/announcement-feed";
import { useAuthStore } from "@/lib/auth/auth.store";

/**
 * The composer owns the rich-text editor and the pickers, so it is a separate
 * chunk, fetched when the admin view opens and mounted on the first click.
 */
const AnnouncementComposerDialog = dynamic(
  () =>
    import("@/components/announcements/composer/announcement-composer-dialog").then(
      (m) => m.AnnouncementComposerDialog,
    ),
  { ssr: false },
);

type View = "user" | "admin";

interface ComposerState {
  mode: ComposerMode;
  id: number | null;
  open: boolean;
}

function AnnouncementsPageInner() {
  const t = useTranslations("announcements.page");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { canAccessRoute } = useAuthStore();
  const canAdmin = canAccessRoute({ service: "Notifications", method: "POST", path: "/announcements" });

  // ?view=admin opens the admin view (only for people who may use it);
  // ?announcement=ID comes from a notification and is read by the feed.
  const view: View = searchParams.get("view") === "admin" && canAdmin ? "admin" : "user";
  const rawLinkId = searchParams.get("announcement");
  const deepLinkId = rawLinkId && /^\d+$/.test(rawLinkId) ? Number(rawLinkId) : null;

  const changeView = useCallback(
    (next: View) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "admin") params.set("view", "admin");
      else params.delete("view");
      params.delete("announcement");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // The composer's chunk is ready by the time someone clicks Create.
  useEffect(() => {
    if (view === "admin") void import("@/components/announcements/composer/announcement-composer-dialog");
  }, [view]);

  // The state stays after closing so the dialog can play its exit animation.
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const openComposer = (mode: ComposerMode, id: number | null = null) =>
    setComposer({ mode, id, open: true });

  return (
    <Tabs value={view} onValueChange={(next) => changeView(next as View)} className="gap-6">
      <PageHeader title={t("title")} description={t("description")}>
        <div className="flex flex-wrap items-center gap-2">
          {canAdmin && (
            <TabsList aria-label={t("views.label")}>
              <TabsTrigger value="user" className="gap-1.5 px-3">
                <User aria-hidden />
                {t("views.user")}
              </TabsTrigger>
              <TabsTrigger value="admin" className="gap-1.5 px-3">
                <Shield aria-hidden />
                {t("views.admin")}
              </TabsTrigger>
            </TabsList>
          )}
          {view === "admin" && (
            <Button type="button" size="sm" className="gap-1.5" onClick={() => openComposer("create")}>
              <Plus aria-hidden />
              <span className="hidden sm:inline">{t("create")}</span>
              <span className="sm:hidden">{t("createShort")}</span>
            </Button>
          )}
        </div>
      </PageHeader>

      <TabsContent value="user">
        <AnnouncementFeed deepLinkId={deepLinkId} />
      </TabsContent>

      {canAdmin && (
        <TabsContent value="admin">
          <AnnouncementAdminList
            onCreate={() => openComposer("create")}
            onEdit={(id) => openComposer("edit", id)}
          />
        </TabsContent>
      )}

      {composer && (
        <AnnouncementComposerDialog
          // A different announcement is a fresh session.
          key={`${composer.mode}-${composer.id ?? "new"}`}
          mode={composer.mode}
          announcementId={composer.id}
          open={composer.open}
          onOpenChange={(open) => setComposer((current) => (current ? { ...current, open } : current))}
        />
      )}
    </Tabs>
  );
}

export default function AnnouncementsPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full max-w-2xl" />
        </div>
      }
    >
      <AnnouncementsPageInner />
    </Suspense>
  );
}
