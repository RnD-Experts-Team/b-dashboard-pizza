"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { parseApiError } from "@/lib/api/utils/error";
import { shirtCatalogService } from "@/lib/api/services/shirt-catalog.service";
import { LogoThumb } from "@/components/shirts/shirt-ui";
import type { ShirtLogo } from "@/types/shirt-milestone.types";

const MAX_BYTES = 2 * 1024 * 1024;

export interface ShirtLogoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create. */
  logo: ShirtLogo | null;
  onSaved: () => void;
}

export function ShirtLogoFormDialog({
  open,
  onOpenChange,
  logo,
  onSaved,
}: ShirtLogoFormDialogProps) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setName(logo?.name ?? "");
    setFile(null);
    setIsActive(logo?.is_active ?? true);
    setSortOrder(String(logo?.sort_order ?? 0));
    setError(null);
  }, [open, logo]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError({ message: "Give the logo a name.", details: [] });
      return;
    }
    // Non-negotiable even on an edit: the API treats an update as a full
    // replacement, so a missing file is a 422 rather than "keep the old one".
    if (!file) {
      setError({
        message: "Choose a logo file.",
        details: [
          "Editing a logo replaces it outright — the file has to be uploaded again.",
        ],
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      setError({ message: "That file is larger than 2 MB.", details: [] });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const input = {
        name: name.trim(),
        file,
        is_active: isActive,
        sort_order: Number(sortOrder) || 0,
      };
      if (logo) {
        await shirtCatalogService.updateLogo(logo.id, input);
        toast.success("Logo updated.");
      } else {
        await shirtCatalogService.createLogo(input);
        toast.success("Logo added.");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(parseApiError(err, "Could not save the logo."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{logo ? "Edit logo" : "Add logo"}</DialogTitle>
          <DialogDescription>
            SVG or transparent PNG, up to 2 MB. Logos are stored exactly as
            uploaded — they never change colour.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              File <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-3">
              {logo && !previewUrl && <LogoThumb logo={logo} className="h-10 w-10" />}
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 object-contain"
                />
              )}
              <Input
                type="file"
                accept=".svg,image/svg+xml,.png,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {logo && (
              <p className="text-xs text-muted-foreground">
                Re-upload the file to save changes — the API treats an update as a
                full replacement.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="logo-active">Active</Label>
            <Switch id="logo-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Sort order</Label>
            <Input
              type="number"
              min={0}
              max={65535}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{error.message}</AlertTitle>
              {error.details.length > 0 && (
                <AlertDescription>
                  <ul className="list-disc ps-4">
                    {error.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </AlertDescription>
              )}
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
