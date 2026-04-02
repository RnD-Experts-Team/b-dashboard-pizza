"use client";

import { useState } from "react";
import { useAnnouncementStore } from "@/lib/store/announcement.store";
import type { CreateAnnouncementInput, AnnouncementPriority, AnnouncementMediaType } from "@/types/announcement.types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initialForm: CreateAnnouncementInput = {
  title: "",
  content: "",
  priority: "normal",
  media: undefined,
};

export function CreateAnnouncementDialog({
  open,
  onOpenChange,
}: CreateAnnouncementDialogProps) {
  const { addAnnouncement } = useAnnouncementStore();
  const [form, setForm] = useState<CreateAnnouncementInput>(initialForm);
  const [hasMedia, setHasMedia] = useState(false);
  const [mediaType, setMediaType] = useState<AnnouncementMediaType>("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaAlt, setMediaAlt] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;

    const input: CreateAnnouncementInput = {
      ...form,
      media:
        hasMedia && mediaUrl.trim()
          ? { type: mediaType, url: mediaUrl.trim(), alt: mediaAlt.trim() || undefined }
          : undefined,
    };

    addAnnouncement(input);
    handleClose();
  }

  function handleClose() {
    setForm(initialForm);
    setHasMedia(false);
    setMediaType("image");
    setMediaUrl("");
    setMediaAlt("");
    onOpenChange(false);
  }

  const isValid = form.title.trim().length > 0 && form.content.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Create Announcement
          </DialogTitle>
          <DialogDescription>
            Post an announcement visible to all dashboard users.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              placeholder="Announcement title..."
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={120}
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-content">Message</Label>
            <Textarea
              id="ann-content"
              placeholder="Write your announcement..."
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={4}
              maxLength={1500}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-end">
              {form.content.length}/1500
            </p>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-priority">Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, priority: v as AnnouncementPriority }))
              }
            >
              <SelectTrigger id="ann-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="important">Important</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Media toggle */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="has-media"
                checked={hasMedia}
                onChange={(e) => setHasMedia(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              <Label htmlFor="has-media" className="cursor-pointer">
                Attach media (image, GIF, or video)
              </Label>
            </div>

            {hasMedia && (
              <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
                {/* Media type */}
                <div className="space-y-1.5">
                  <Label htmlFor="media-type">Media type</Label>
                  <Select
                    value={mediaType}
                    onValueChange={(v) => setMediaType(v as AnnouncementMediaType)}
                  >
                    <SelectTrigger id="media-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="gif">GIF</SelectItem>
                      <SelectItem value="video">Video (embed URL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Media URL */}
                <div className="space-y-1.5">
                  <Label htmlFor="media-url">
                    {mediaType === "video" ? "YouTube embed URL" : "Image URL"}
                  </Label>
                  <Input
                    id="media-url"
                    placeholder={
                      mediaType === "video"
                        ? "https://www.youtube.com/embed/..."
                        : "https://example.com/image.jpg"
                    }
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                </div>

                {/* Alt text */}
                <div className="space-y-1.5">
                  <Label htmlFor="media-alt">
                    Alt text{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="media-alt"
                    placeholder="Describe the media..."
                    value={mediaAlt}
                    onChange={(e) => setMediaAlt(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              <Megaphone className="h-4 w-4 me-1.5" />
              Post Announcement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
