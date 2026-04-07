"use client";

import { useState, useEffect, useCallback } from "react";
import { useAnnouncementStore } from "@/lib/store/announcement.store";
import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { CreateAnnouncementDialog } from "@/components/announcements/create-announcement-dialog";
import { EditAnnouncementDialog } from "@/components/announcements/edit-announcement-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Megaphone, Shield, User, RefreshCw, AlertCircle, Plus, Eye, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

type ViewMode = "user" | "admin";

export default function AnnouncementsPage() {
  const {
    announcements,
    seenIds,
    isLoading,
    error,
    isMarkingSeen,
    isDeleting,
    fetchVisibleAnnouncements,
    fetchAllAnnouncements,
    markSeen,
    deleteAnnouncement,
    setActivePopup,
  } = useAnnouncementStore();
  const [viewMode, setViewMode] = useState<ViewMode>("user");
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteErrMsg, setDeleteErrMsg] = useState<string | null>(null);

  const fetchData = useCallback(
    (mode: ViewMode, signal?: AbortSignal) => {
      if (mode === "admin") {
        fetchAllAnnouncements(signal);
      } else {
        fetchVisibleAnnouncements(signal);
      }
    },
    [fetchAllAnnouncements, fetchVisibleAnnouncements],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(viewMode, controller.signal);
    return () => controller.abort();
  }, [viewMode, fetchData]);

  const handleToggleView = (mode: ViewMode) => {
    if (mode !== viewMode) {
      setViewMode(mode);
    }
  };

  const unseenIds = announcements
    .filter((a) => !seenIds.includes(a.id))
    .map((a) => a.id);

  const handleMarkAllSeen = useCallback(async () => {
    if (unseenIds.length === 0) return;
    await markSeen(unseenIds);
  }, [markSeen, unseenIds]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Stay up to date with the latest news and updates."
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={viewMode === "user" ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => handleToggleView("user")}
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">User View</span>
          </Button>
          <Button
            variant={viewMode === "admin" ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => handleToggleView("admin")}
          >
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Admin View</span>
          </Button>
          {viewMode === "user" && unseenIds.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              disabled={isMarkingSeen}
              onClick={handleMarkAllSeen}
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Mark All as Seen ({unseenIds.length})</span>
              <span className="sm:hidden">All Seen ({unseenIds.length})</span>
            </Button>
          )}
          {viewMode === "admin" && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Announcement</span>
              <span className="sm:hidden">Create</span>
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => fetchData(viewMode)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading announcements...</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
        <>
          {announcements.length > 0 ? (
            <div className="mx-auto max-w-2xl space-y-4 sm:space-y-5">
              {announcements.map((ann) => (
                <AnnouncementCard
                  key={ann.id}
                  announcement={ann}
                  isUserView={viewMode === "user"}
                  isSeen={viewMode === "user" && seenIds.includes(ann.id)}
                  onMarkSeen={(id) => markSeen([id])}
                  isMarkingSeen={isMarkingSeen}
                  onEdit={(id) => setEditId(id)}
                  onDelete={(id) => setDeleteId(id)}
                  isDeleting={isDeleting}
                  onView={viewMode === "user" ? () => setActivePopup(ann) : undefined}
                />
              ))}
            </div>
          ) : (
            <EmptyState viewMode={viewMode} onCreateClick={() => setCreateOpen(true)} />
          )}
        </>
      )}

      <CreateAnnouncementDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => fetchData(viewMode)}
      />

      <EditAnnouncementDialog
        announcementId={editId}
        open={editId !== null}
        onOpenChange={(open) => !open && setEditId(null)}
        onSuccess={() => fetchData(viewMode)}
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteErrMsg(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Announcement
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The announcement will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteErrMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{deleteErrMsg}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                if (deleteId === null) return;
                setDeleteErrMsg(null);
                const ok = await deleteAnnouncement(deleteId);
                if (ok) {
                  toast.success("Announcement deleted.");
                  setDeleteId(null);
                } else {
                  const storeErr = useAnnouncementStore.getState().deleteError;
                  setDeleteErrMsg(storeErr ?? "Failed to delete the announcement.");
                }
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({
  viewMode,
  onCreateClick,
}: {
  viewMode: ViewMode;
  onCreateClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Megaphone className="h-12 w-12 mb-4 opacity-30" />
      <p className="text-base font-medium">No announcements</p>
      <p className="text-sm mt-1 text-center max-w-xs">
        {viewMode === "admin"
          ? "There are no announcements in the system yet."
          : "No announcements are visible to you right now."}
      </p>
      {viewMode === "admin" && (
        <Button size="sm" className="mt-4 gap-1.5" onClick={onCreateClick}>
          <Plus className="h-4 w-4" />
          Create Announcement
        </Button>
      )}
    </div>
  );
}


