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
import type { ShirtColor } from "@/types/shirt-milestone.types";

/** The server accepts 3- or 6-digit hex with or without "#". <input type="color">
 *  needs a full #RRGGBB, so expand for the picker without rewriting the field. */
function toPickerValue(hex: string): string {
  const raw = hex.replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  }
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw}` : "#000000";
}

export interface ShirtColorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create. */
  color: ShirtColor | null;
  onSaved: () => void;
}

export function ShirtColorFormDialog({
  open,
  onOpenChange,
  color,
  onSaved,
}: ShirtColorFormDialogProps) {
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#C8102E");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setName(color?.name ?? "");
    setHex(color?.hex_code ?? "#C8102E");
    setIsActive(color?.is_active ?? true);
    setSortOrder(String(color?.sort_order ?? 0));
    setError(null);
  }, [open, color]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError({ message: "Give the colour a name.", details: [] });
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        hex_code: hex.trim(),
        is_active: isActive,
        sort_order: Number(sortOrder) || 0,
      };
      // PUT is a genuine patch here — colours are the one catalog entity that
      // does not need the whole payload resent.
      const saved = color
        ? await shirtCatalogService.updateColor(color.id, payload)
        : await shirtCatalogService.createColor(payload);
      // The server normalises to uppercase #RRGGBB, so take its answer rather
      // than leaving the field showing what was typed.
      setHex(saved.hex_code);
      toast.success(color ? "Colour updated." : "Colour added.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(parseApiError(err, "Could not save the colour."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{color ? "Edit colour" : "Add colour"}</DialogTitle>
          <DialogDescription>
            Colours tint the shirt in the preview and on the ordered shirt.
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
              placeholder="Classic Red"
              maxLength={100}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              Hex <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={toPickerValue(hex)}
                onChange={(e) => setHex(e.target.value.toUpperCase())}
                className="h-9 w-14 p-1"
                aria-label="Pick a colour"
              />
              <Input
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                placeholder="#C8102E"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              3- or 6-digit hex, with or without the #.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="color-active">Active</Label>
            <Switch id="color-active" checked={isActive} onCheckedChange={setIsActive} />
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
