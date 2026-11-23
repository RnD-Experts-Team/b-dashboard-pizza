"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Megaphone, Plus, Search, SearchX, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ANNOUNCEMENT_STATUSES,
  announcementStatus,
  countByStatus,
  type AnnouncementStatus,
} from "@/lib/announcements/status";
import { useAnnouncementStore } from "@/lib/store/announcement.store";
import type { Announcement } from "@/types/announcement.types";
import { AnnouncementErrorAlert } from "../shared/announcement-error-alert";
import { AdminRow, AdminRowSkeleton } from "./admin-row";

/** The preview is the popup card in its dismissible mode; its chunk loads when first needed. */
const AnnouncementPopupCard = dynamic(
  () => import("../popup/announcement-popup-card").then((m) => m.AnnouncementPopupCard),
  { ssr: false },
);

type StatusFilter = "all" | AnnouncementStatus;

export interface AnnouncementAdminListProps {
  onEdit: (id: number) => void;
  onCreate: () => void;
  className?: string;
}

/** "Now", refreshed every 30 s, so a status chip turns over on its own. */
function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * The admin view: every announcement (paged), with status tabs and their
 * counts, a title search, and a row per announcement with Preview / Edit /
 * Delete. Delete asks first and shows the backend's own refusal; Preview opens
 * the real popup card without marking anything seen.
 *
 * The counts and the filters work on the announcements loaded so far; when
 * more pages exist a line under the tabs says so.
 */
export function AnnouncementAdminList({ onEdit, onCreate, className }: AnnouncementAdminListProps) {
  const t = useTranslations("announcements");
  const tAdmin = useTranslations("announcements.admin");

  const admin = useAnnouncementStore((s) => s.admin);
  const loadAdmin = useAnnouncementStore((s) => s.loadAdmin);
  const loadMoreAdmin = useAnnouncementStore((s) => s.loadMoreAdmin);
  const deleteAnnouncement = useAnnouncementStore((s) => s.deleteAnnouncement);
  const isDeleting = useAnnouncementStore((s) => s.isDeleting);
  const deleteError = useAnnouncementStore((s) => s.deleteError);
  const clearActionErrors = useAnnouncementStore((s) => s.clearActionErrors);

  const now = useNow();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const [previewTarget, setPreviewTarget] = useState<Announcement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // The target stays while the dialog fades out, so its text doesn't empty mid-animation.
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadAdmin(undefined, controller.signal);
    return () => controller.abort();
  }, [loadAdmin]);

  const { items, status } = admin;
  const counts = useMemo(() => countByStatus(items, now), [items, now]);

  const needle = query.trim().toLocaleLowerCase();
  const visible = useMemo(
    () =>
      items.filter((a) => {
        if (statusFilter !== "all" && announcementStatus(a, now) !== statusFilter) return false;
        return !needle || a.title.toLocaleLowerCase().includes(needle);
      }),
    [items, statusFilter, needle, now],
  );

  const hasMorePages = admin.page > 0 && admin.page < admin.lastPage;
  const filtering = statusFilter !== "all" || needle !== "";
  const firstLoad = items.length === 0 && (status === "loading" || status === "idle");

  const clearFilters = () => {
    setStatusFilter("all");
    setQuery("");
  };

  const openDelete = (announcement: Announcement) => {
    clearActionErrors();
    setDeleteTarget(announcement);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteAnnouncement(deleteTarget.id);
    if (result.ok) {
      toast.success(tAdmin("deleteDialog.success"));
      setDeleteOpen(false);
    }
    // On failure the dialog stays open and shows the backend's own message.
  };

  const tabLabel = (value: StatusFilter) => (value === "all" ? tAdmin("tabs.all") : t(`status.${value}`));

  return (
    <div data-slot="announcement-admin-list" className={cn("space-y-4", className)}>
      {/* Status tabs + search */}
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          className="min-w-0"
        >
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList className="h-auto w-max flex-nowrap gap-1 p-1" aria-label={tAdmin("statusTabs")}>
              {(["all", ...ANNOUNCEMENT_STATUSES] as StatusFilter[]).map((value) => (
                <TabsTrigger key={value} value={value} className="flex-none gap-1.5 px-3 py-1.5">
                  {tabLabel(value)}
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      statusFilter === value ? "bg-muted text-foreground" : "bg-background/60 text-muted-foreground",
                    )}
                  >
                    {counts[value]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {/* The tabs only choose the filter; the list below is their one panel. */}
          <TabsContent value={statusFilter} forceMount className="sr-only" />
        </Tabs>

        <div className="relative w-full md:max-w-xs">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tAdmin("searchPlaceholder")}
            aria-label={tAdmin("searchLabel")}
            className="ps-9 pe-9"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setQuery("")}
              className="absolute end-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X aria-hidden />
              <span className="sr-only">{tAdmin("clearSearch")}</span>
            </Button>
          )}
        </div>
      </div>

      {hasMorePages && (
        <p className="text-xs text-muted-foreground">
          {tAdmin("countsNote", { loaded: items.length, total: admin.total })}
        </p>
      )}

      {/* The load failed (with nothing to show, or a refresh that failed) */}
      {status === "error" && (
        <AnnouncementErrorAlert
          error={admin.error}
          title={tAdmin("loadError")}
          onRetry={() => void loadAdmin()}
        />
      )}

      {firstLoad && (
        <ul className="space-y-3" aria-busy aria-label={tAdmin("loading")}>
          {Array.from({ length: 5 }, (_, i) => (
            <AdminRowSkeleton key={i} />
          ))}
        </ul>
      )}

      {/* Empty: nothing exists yet */}
      {status === "success" && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-20 text-center">
          <Megaphone className="size-10 text-muted-foreground/50" aria-hidden />
          <div className="space-y-1">
            <p className="font-heading text-base font-medium">{tAdmin("emptyTitle")}</p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">{tAdmin("emptyHint")}</p>
          </div>
          <Button type="button" size="sm" className="gap-1.5" onClick={onCreate}>
            <Plus aria-hidden />
            {tAdmin("create")}
          </Button>
        </div>
      )}

      {/* Empty: the filters hide everything */}
      {items.length > 0 && visible.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
          <SearchX className="size-9 text-muted-foreground/50" aria-hidden />
          <div className="space-y-1">
            <p className="font-heading text-base font-medium">{tAdmin("noMatchTitle")}</p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">{tAdmin("noMatchHint")}</p>
          </div>
          {filtering && (
            <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
              {tAdmin("clearFilters")}
            </Button>
          )}
        </div>
      )}

      {visible.length > 0 && (
        <ul className="space-y-3" aria-label={tAdmin("listLabel")}>
          {visible.map((announcement) => (
            <AdminRow
              key={announcement.id}
              announcement={announcement}
              now={now}
              onPreview={(a) => {
                setPreviewTarget(a);
                setPreviewOpen(true);
              }}
              onEdit={onEdit}
              onDelete={openDelete}
            />
          ))}
        </ul>
      )}

      {/* Paging */}
      {admin.loadMoreError && (
        <AnnouncementErrorAlert
          error={admin.loadMoreError}
          title={tAdmin("loadMoreError")}
          onRetry={() => void loadMoreAdmin()}
          compact
        />
      )}
      {hasMorePages && !admin.loadMoreError && (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={admin.loadingMore}
            onClick={() => void loadMoreAdmin()}
            className="gap-1.5"
          >
            {admin.loadingMore && (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            )}
            {admin.loadingMore ? tAdmin("loadingMore") : tAdmin("loadMore")}
          </Button>
        </div>
      )}

      {/* Preview: the popup card, dismissible, nothing marked seen */}
      {previewTarget && (
        <AnnouncementPopupCard
          mode="preview"
          announcement={previewTarget}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}

      {/* Delete */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || isDeleting) return;
          setDeleteOpen(false);
          clearActionErrors();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 shrink-0 text-destructive" aria-hidden />
              {tAdmin("deleteDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="break-words [overflow-wrap:anywhere]">
              {tAdmin("deleteDialog.description", { title: deleteTarget?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <AnnouncementErrorAlert
              error={deleteError}
              title={tAdmin("deleteDialog.failed")}
              compact
            />
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tAdmin("deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {isDeleting && (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {isDeleting ? tAdmin("deleteDialog.deleting") : tAdmin("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
