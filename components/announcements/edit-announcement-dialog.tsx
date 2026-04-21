"use client";

import { useState, useEffect } from "react";
import { useAnnouncementStore } from "@/lib/store/announcement.store";
import { announcementService } from "@/lib/api/services/announcement.service";
import type { AnnouncementType, UpdateAnnouncementPayload } from "@/types/announcement.types";
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
import { Pencil, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface EditAnnouncementDialogProps {
  announcementId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function toLocalDatetime(isoString: string): string {
  const d = new Date(isoString);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toRFC3339(localDatetime: string): string {
  return new Date(localDatetime).toISOString();
}

interface FormState {
  title: string;
  body: string;
  type: AnnouncementType;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  is_pinned: boolean;
  version: string;
}

export function EditAnnouncementDialog({
  announcementId,
  open,
  onOpenChange,
  onSuccess,
}: EditAnnouncementDialogProps) {
  const { updateAnnouncement, isUpdating, updateError } = useAnnouncementStore();
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    title: "",
    body: "",
    type: "general",
    starts_at: "",
    ends_at: "",
    is_active: true,
    is_pinned: false,
    version: "",
  });

  // Fetch announcement data when dialog opens
  useEffect(() => {
    if (!open || !announcementId) return;

    let cancelled = false;
    setIsLoadingData(true);
    setLoadError(null);

    announcementService
      .getAnnouncement(announcementId)
      .then((ann) => {
        if (cancelled) return;
        setForm({
          title: ann.title,
          body: ann.body,
          type: ann.type,
          starts_at: toLocalDatetime(ann.starts_at),
          ends_at: toLocalDatetime(ann.ends_at),
          is_active: ann.is_active,
          is_pinned: ann.is_pinned,
          version: ann.version ?? "",
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "Failed to load announcement",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, announcementId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementId || !form.title.trim() || !form.body || form.body === "<p></p>") return;

    const payload: UpdateAnnouncementPayload = {
      title: form.title.trim(),
      body: form.body,
      type: form.type,
      starts_at: toRFC3339(form.starts_at),
      ends_at: toRFC3339(form.ends_at),
      is_active: form.is_active,
      is_pinned: form.is_pinned,
      ...(form.version.trim() && { version: form.version.trim() }),
    };

    const ok = await updateAnnouncement(announcementId, payload);
    if (ok) {
      toast.success("Announcement updated successfully.");
      onOpenChange(false);
      onSuccess?.();
    }
  }

  function handleClose() {
    onOpenChange(false);
  }

  const isValid =
    form.title.trim().length > 0 &&
    form.body.length > 0 &&
    form.body !== "<p></p>" &&
    form.starts_at &&
    form.ends_at;

  const errorMessage = loadError || updateError;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Announcement
          </DialogTitle>
          <DialogDescription>
            Update the details of this announcement.
          </DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Loading announcement...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-ann-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-ann-title"
                placeholder="Announcement title..."
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
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
              <Label htmlFor="edit-ann-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as AnnouncementType }))
                }
              >
                <SelectTrigger id="edit-ann-type">
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
                <Label htmlFor="edit-ann-starts">
                  Starts at <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-ann-starts"
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, starts_at: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-ann-ends">
                  Ends at <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-ann-ends"
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ends_at: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            {/* Version (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-ann-version">
                Version{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                id="edit-ann-version"
                placeholder="e.g. 1.0.0"
                value={form.version}
                onChange={(e) =>
                  setForm((f) => ({ ...f, version: e.target.value }))
                }
                maxLength={50}
              />
            </div>

            {/* Toggles */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="edit-ann-active"
                  checked={form.is_active}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, is_active: v }))
                  }
                />
                <Label htmlFor="edit-ann-active" className="cursor-pointer">
                  Active
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="edit-ann-pinned"
                  checked={form.is_pinned}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, is_pinned: v }))
                  }
                />
                <Label htmlFor="edit-ann-pinned" className="cursor-pointer">
                  Pinned
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid || isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin me-1.5" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 me-1.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
