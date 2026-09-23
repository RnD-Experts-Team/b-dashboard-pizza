"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseApiError } from "@/lib/api/utils/error";
import { shirtCatalogService } from "@/lib/api/services/shirt-catalog.service";
import { ShirtPreview } from "@/components/shirts/shirt-preview";
import type {
  ShirtColor,
  ShirtGender,
  ShirtLogo,
  ShirtTemplate,
} from "@/types/shirt-milestone.types";

const MAX_BYTES = 2 * 1024 * 1024;
const UNISEX = "__unisex__";

export interface ShirtTemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create. */
  template: ShirtTemplate | null;
  /** Used only to make the print_area preview legible. */
  sampleColor: ShirtColor | null;
  sampleLogo: ShirtLogo | null;
  onSaved: () => void;
}

export function ShirtTemplateFormDialog({
  open,
  onOpenChange,
  template,
  sampleColor,
  sampleLogo,
  onSaved,
}: ShirtTemplateFormDialogProps) {
  const [name, setName] = useState("");
  const [svg, setSvg] = useState<File | null>(null);
  const [gender, setGender] = useState<string>(UNISEX);
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [area, setArea] = useState({ x: "0", y: "0", width: "100", height: "100" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setSvg(null);
    setGender(template?.gender ?? UNISEX);
    setIsDefault(template?.is_default ?? false);
    setIsActive(template?.is_active ?? true);
    setArea({
      x: String(template?.print_area?.x ?? 0),
      y: String(template?.print_area?.y ?? 0),
      width: String(template?.print_area?.width ?? 100),
      height: String(template?.print_area?.height ?? 100),
    });
    setError(null);
  }, [open, template]);

  /* Preview the saved template with the live print_area numbers, so the
     coordinates can be eyeballed before saving rather than guessed at. */
  const previewTemplate: ShirtTemplate | null = useMemo(() => {
    if (!template) return null;
    return {
      ...template,
      print_area: {
        x: Number(area.x) || 0,
        y: Number(area.y) || 0,
        width: Number(area.width) || 1,
        height: Number(area.height) || 1,
      },
    };
  }, [template, area]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError({ message: "Give the template a name.", details: [] });
      return;
    }
    // Same full-replacement rule as logos.
    if (!svg) {
      setError({
        message: "Choose an SVG file.",
        details: [
          "Editing a template replaces it outright — the SVG has to be uploaded again.",
        ],
      });
      return;
    }
    if (svg.size > MAX_BYTES) {
      setError({ message: "That file is larger than 2 MB.", details: [] });
      return;
    }
    const width = Number(area.width);
    const height = Number(area.height);
    if (!(width > 0) || !(height > 0)) {
      setError({
        message: "Print area width and height must be greater than zero.",
        details: [],
      });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const input = {
        name: name.trim(),
        svg,
        print_area: {
          x: Number(area.x) || 0,
          y: Number(area.y) || 0,
          width,
          height,
        },
        // Omit the field entirely for unisex.
        gender: gender === UNISEX ? null : (gender as ShirtGender),
        is_default: isDefault,
        is_active: isActive,
      };
      if (template) {
        await shirtCatalogService.updateTemplate(template.id, input);
        toast.success("Template updated.");
      } else {
        await shirtCatalogService.createTemplate(input);
        toast.success("Template added.");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(parseApiError(err, "Could not save the template."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "Add template"}</DialogTitle>
          <DialogDescription>
            The shirt artwork. Its main fill colour is recoloured to the chosen
            shirt colour; everything else keeps its own fill. To control exactly
            which paths change, give them fill=&quot;currentColor&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_14rem]">
          <div className="order-first md:order-last">
            <ShirtPreview
              template={previewTemplate}
              color={sampleColor}
              logo={sampleLogo}
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {template
                ? "Preview uses the saved artwork with the print area below."
                : "Save the template to preview it."}
            </p>
          </div>

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
                SVG <span className="text-destructive">*</span>
              </Label>
              <Input
                type="file"
                accept=".svg,image/svg+xml"
                onChange={(e) => setSvg(e.target.files?.[0] ?? null)}
              />
              {template && (
                <p className="text-xs text-muted-foreground">
                  Re-upload the file to save changes — the API treats an update as a
                  full replacement.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNISEX}>Unisex</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Print area</Label>
              <p className="text-xs text-muted-foreground">
                In the SVG&apos;s own viewBox units, not pixels.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "width", "height"] as const).map((k) => (
                  <div key={k} className="flex flex-col gap-1">
                    <Label className="text-xs capitalize">{k}</Label>
                    <Input
                      type="number"
                      value={area[k]}
                      onChange={(e) =>
                        setArea((prev) => ({ ...prev, [k]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="tpl-default">Default template</Label>
              <Switch
                id="tpl-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="tpl-active">Active</Label>
              <Switch id="tpl-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
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
