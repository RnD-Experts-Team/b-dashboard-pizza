"use client";

import { useState } from "react";
import { useAnnouncementStore } from "@/lib/store/announcement.store";
import type { AnnouncementType, CreateAnnouncementPayload } from "@/types/announcement.types";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Megaphone, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface CreateAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function toRFC3339(localDatetime: string): string {
  // localDatetime from <input type="datetime-local"> is "YYYY-MM-DDTHH:mm"
  // Convert to UTC ISO string (RFC 3339)
  return new Date(localDatetime).toISOString();
}

function defaultDatetime(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Format as "YYYY-MM-DDTHH:mm" for datetime-local input
  return d.toISOString().slice(0, 16);
}

const initialForm = {
  title: "",
  body: "",
  type: "general" as AnnouncementType,
  starts_at: defaultDatetime(0),
  ends_at: defaultDatetime(7),
  is_active: true,
  is_pinned: false,
  version: "",
};

export function CreateAnnouncementDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateAnnouncementDialogProps) {
  const { createAnnouncement, isCreating, createError } = useAnnouncementStore();
  const [form, setForm] = useState(initialForm);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body || form.body === "<p></p>") return;

    const payload: CreateAnnouncementPayload = {
      title: form.title.trim(),
      body: form.body,
      type: form.type,
      starts_at: toRFC3339(form.starts_at),
      ends_at: toRFC3339(form.ends_at),
      is_active: form.is_active,
      is_pinned: form.is_pinned,
      ...(form.version.trim() && { version: form.version.trim() }),
    };

    const ok = await createAnnouncement(payload);
    if (ok) {
      toast.success("Announcement posted successfully.");
      handleClose();
      onSuccess?.();
    }
  }

  function handleClose() {
    setForm(initialForm);
    onOpenChange(false);
  }

  const isValid =
    form.title.trim().length > 0 &&
    form.body.length > 0 &&
    form.body !== "<p></p>" &&
    form.starts_at &&
    form.ends_at;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Create Announcement
          </DialogTitle>
          <DialogDescription>
            Post an announcement to all dashboard users.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {createError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <span>{createError.message}</span>
                {createError.details.length > 0 && (
                  <ul className="mt-1 list-disc ps-4 text-xs space-y-0.5">
                    {createError.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ann-title"
              placeholder="Announcement title..."
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={255}
              required
            />
          </div>

          {/* Body — Rich Text Editor */}
          <div className="space-y-1.5">
            <Label>
              Body <span className="text-destructive">*</span>
            </Label>
            <RichTextEditor
              value={form.body}
              onChange={(html) => setForm((f) => ({ ...f, body: html }))}
              placeholder="Write your announcement..."
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-type">Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v as AnnouncementType }))}
            >
              <SelectTrigger id="ann-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ann-starts">
                Starts at <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ann-starts"
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-ends">
                Ends at <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ann-ends"
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Version (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-version">
              Version <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Input
              id="ann-version"
              placeholder="e.g. 1.0.0"
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              maxLength={50}
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3">
              <Switch
                id="ann-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="ann-active" className="cursor-pointer">Active</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="ann-pinned"
                checked={form.is_pinned}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_pinned: v }))}
              />
              <Label htmlFor="ann-pinned" className="cursor-pointer">Pinned</Label>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isCreating}>
              {isCreating ? (
                <>
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin me-1.5" />
                  Posting...
                </>
              ) : (
                <>
                  <Megaphone className="h-4 w-4 me-1.5" />
                  Post Announcement
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

