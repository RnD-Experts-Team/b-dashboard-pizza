"use client";

import { useState } from "react";
import { useAnnouncementStore } from "@/lib/store/announcement.store";
import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { CreateAnnouncementDialog } from "@/components/announcements/create-announcement-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Megaphone, Plus, CheckCheck } from "lucide-react";

export default function AnnouncementsPage() {
  const { announcements, markAsSeen, markAllAsSeen } = useAnnouncementStore();
  const [createOpen, setCreateOpen] = useState(false);

  const unseenCount = announcements.filter((a) => !a.seen).length;
  const unseenAnnouncements = announcements.filter((a) => !a.seen);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Stay up to date with the latest news and updates from management."
      >
        {unseenCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={markAllAsSeen}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as seen
          </Button>
        )}
        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Announcement
        </Button>
      </PageHeader>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            All{" "}
            <span className="ms-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
              {announcements.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="unseen">
            New{" "}
            {unseenCount > 0 && (
              <span className="ms-1.5 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-xs font-medium">
                {unseenCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* All announcements — feed layout, most recent at top */}
        <TabsContent value="all" className="mt-6">
          {announcements.length > 0 ? (
            <div className="mx-auto max-w-2xl space-y-5">
              {announcements.map((ann) => (
                <AnnouncementCard
                  key={ann.id}
                  announcement={ann}
                  onMarkSeen={markAsSeen}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </TabsContent>

        {/* Unseen only */}
        <TabsContent value="unseen" className="mt-6">
          {unseenAnnouncements.length > 0 ? (
            <div className="mx-auto max-w-2xl space-y-5">
              {unseenAnnouncements.map((ann) => (
                <AnnouncementCard
                  key={ann.id}
                  announcement={ann}
                  onMarkSeen={markAsSeen}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCheck className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">You&apos;re all caught up!</p>
              <p className="text-xs mt-1">No new announcements.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateAnnouncementDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Megaphone className="h-12 w-12 mb-4 opacity-30" />
      <p className="text-base font-medium">No announcements yet</p>
      <p className="text-sm mt-1 text-center max-w-xs">
        Announcements from management will appear here. Use the{" "}
        <strong>Create Announcement</strong> button to post one.
      </p>
    </div>
  );
}
