"use client";

import { useEffect, useMemo, useRef, useState } from "react";
/* eslint-disable @next/next/no-img-element -- backend images are served via the
   same-origin /inventory-storage proxy; next/image remote config is unnecessary here. */
import { AlertCircle, Building2, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { MultiSelect } from "@/components/daily-pay/multi-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useItemMutations } from "@/lib/hooks/use-inventory-items";
import { useUnitOptions } from "@/lib/hooks/use-inventory-units";
import { useInventoryStores } from "@/lib/hooks/use-inventory-stores";
import type { Item, ItemFormValues, InventoryType } from "@/types/inventory.types";

const TYPE_OPTIONS: InventoryType[] = ["daily", "weekly", "period"];

/** Build the initial form state, optionally from an existing item (edit mode). */
function initialValues(item?: Item | null): ItemFormValues {
  return {
    ultimatrix_id: item?.ultimatrix_id ?? "",
    name_en: item?.name_en ?? "",
    name_ar: item?.name_ar ?? "",
    name_es: item?.name_es ?? "",
    details_en: item?.details_en ?? "",
    details_ar: item?.details_ar ?? "",
    details_es: item?.details_es ?? "",
    unit_1_id: item?.unit_1 ? String(item.unit_1.id) : "",
    unit_2_id: item?.unit_2 ? String(item.unit_2.id) : "",
    unit_2_per_unit_1: item?.unit_2_per_unit_1 ?? "",
    unit_3_id: item?.unit_3 ? String(item.unit_3.id) : "",
    unit_3_per_unit_2: item?.unit_3_per_unit_2 ?? "",
    types: item?.types ?? [],
    all_stores: item?.all_stores ?? true,
    // Stores are identified to the API by their store_number (e.g. "03795-00001").
    store_ids:
      item?.stores
        ?.map((s) => s.store_number)
        .filter((n): n is string => Boolean(n)) ?? [],
    image: null,
  };
}

/**
 * Create/edit form for an inventory Item (multipart, with optional image).
 * Validates the key rules client-side; the server's 422 errors are also surfaced.
 */
export function ItemForm({
  item,
  onSuccess,
}: {
  item?: Item | null;
  onSuccess: () => void;
}) {
  const isEdit = Boolean(item);
  const { createItem, updateItem, isSaving, saveError, clearErrors } =
    useItemMutations();
  const { units } = useUnitOptions();
  const { stores } = useInventoryStores();

  const [values, setValues] = useState<ItemFormValues>(initialValues(item));
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-seed the form if the item prop arrives later (edit page loads async).
  useEffect(() => {
    setValues(initialValues(item));
  }, [item]);

  useEffect(() => clearErrors, [clearErrors]);

  // Preview URL for a newly chosen file (revoked on change/unmount).
  const previewUrl = useMemo(
    () => (values.image ? URL.createObjectURL(values.image) : null),
    [values.image]
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const set = <K extends keyof ItemFormValues>(key: K, val: ItemFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const toggleType = (type: InventoryType) =>
    setValues((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));

  /** Client-side validation mirroring the API rules; returns an error or null. */
  const validate = (): string | null => {
    if (!values.ultimatrix_id.trim()) return "Ultimatrix ID is required.";
    if (!values.name_en.trim() || !values.name_ar.trim() || !values.name_es.trim())
      return "Name (EN, AR, ES) are all required.";
    if (!values.unit_1_id || !values.unit_2_id)
      return "Unit 1 and Unit 2 are required.";
    if (values.unit_1_id === values.unit_2_id)
      return "Unit 2 must be different from Unit 1.";
    if (Number(values.unit_2_per_unit_1) < 0.0001)
      return "Unit 2 per Unit 1 must be at least 0.0001.";
    if (values.unit_3_id && Number(values.unit_3_per_unit_2) < 0.0001)
      return "Unit 3 per Unit 2 is required when Unit 3 is set.";
    if (values.types.length === 0)
      return "Select at least one type (daily / weekly / period).";
    if (!values.all_stores && values.store_ids.length === 0)
      return "Select at least one store, or enable “All stores”.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(null);
    try {
      if (isEdit && item) {
        await updateItem(item.id, values);
        toast.success("Item updated.");
      } else {
        await createItem(values);
        toast.success("Item created.");
      }
      onSuccess();
    } catch {
      // saveError (from the store) is rendered below.
    }
  };

  // "none" sentinel for the optional third unit Select (empty string isn't allowed).
  const NONE = "none";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {(localError || saveError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{localError || saveError}</AlertDescription>
        </Alert>
      )}

      {/* ── Identity & names ── */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ultimatrix_id">
              Ultimatrix ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ultimatrix_id"
              value={values.ultimatrix_id}
              onChange={(e) => set("ultimatrix_id", e.target.value)}
              placeholder="UTX-10042"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name_en">
                Name (EN) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name_en"
                value={values.name_en}
                onChange={(e) => set("name_en", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_ar">
                Name (AR) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name_ar"
                dir="rtl"
                value={values.name_ar}
                onChange={(e) => set("name_ar", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_es">
                Name (ES) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name_es"
                value={values.name_es}
                onChange={(e) => set("name_es", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="details_en">Details (EN)</Label>
              <Textarea
                id="details_en"
                value={values.details_en}
                onChange={(e) => set("details_en", e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="details_ar">Details (AR)</Label>
              <Textarea
                id="details_ar"
                dir="rtl"
                value={values.details_ar}
                onChange={(e) => set("details_ar", e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="details_es">Details (ES)</Label>
              <Textarea
                id="details_es"
                value={values.details_es}
                onChange={(e) => set("details_es", e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Units & conversions ── */}
      <Card>
        <CardHeader>
          <CardTitle>Units &amp; conversions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Unit 1 (base) <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={units.map((u) => ({ value: String(u.id), label: u.name }))}
                value={values.unit_1_id}
                onChange={(v) => set("unit_1_id", v)}
                placeholder="Select unit…"
                searchPlaceholder="Search units…"
                emptyText="No units found."
              />
            </div>
            <div className="space-y-2">
              <Label>
                Unit 2 <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={units.map((u) => ({ value: String(u.id), label: u.name }))}
                value={values.unit_2_id}
                onChange={(v) => set("unit_2_id", v)}
                placeholder="Select unit…"
                searchPlaceholder="Search units…"
                emptyText="No units found."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="u2pu1">
              Unit 2 per Unit 1 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="u2pu1"
              type="number"
              step="0.0001"
              min="0.0001"
              value={values.unit_2_per_unit_1}
              onChange={(e) => set("unit_2_per_unit_1", e.target.value)}
              placeholder="6"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Unit 3 (optional)</Label>
              <SearchableSelect
                options={[
                  { value: NONE, label: "None" },
                  ...units.map((u) => ({ value: String(u.id), label: u.name })),
                ]}
                value={values.unit_3_id || NONE}
                onChange={(v) => set("unit_3_id", v === NONE ? "" : v)}
                placeholder="None"
                searchPlaceholder="Search units…"
                emptyText="No units found."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u3pu2">
                Unit 3 per Unit 2
                {values.unit_3_id && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                id="u3pu2"
                type="number"
                step="0.0001"
                min="0.0001"
                value={values.unit_3_per_unit_2}
                onChange={(e) => set("unit_3_per_unit_2", e.target.value)}
                disabled={!values.unit_3_id}
                placeholder="—"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Types, stores & image ── */}
      <Card>
        <CardHeader>
          <CardTitle>Availability &amp; image</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>
              Types <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-4">
              {TYPE_OPTIONS.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 text-sm capitalize"
                >
                  <Checkbox
                    checked={values.types.includes(type)}
                    onCheckedChange={() => toggleType(type)}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>All stores</Label>
              <p className="text-xs text-muted-foreground">
                When off, choose the specific stores below.
              </p>
            </div>
            <Switch
              checked={values.all_stores}
              onCheckedChange={(v) => set("all_stores", v)}
            />
          </div>

          {!values.all_stores && (
            <div className="space-y-2">
              <Label>
                Stores <span className="text-destructive">*</span>
              </Label>
              {stores.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No stores available from your account.
                </p>
              ) : (
                <MultiSelect
                  options={stores.map((s) => ({
                    value: s.storeId,
                    label: s.name,
                    hint: s.storeId,
                  }))}
                  selected={values.store_ids}
                  onChange={(ids) => set("store_ids", ids)}
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  placeholder="Select stores…"
                  searchPlaceholder="Search stores…"
                  emptyText="No stores found."
                />
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Image (optional, jpg/png, max 2 MB)</Label>
            <div className="flex items-center gap-4">
              {/* Show new preview, else the existing image when editing */}
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-20 w-20 rounded-md border object-cover"
                />
              ) : item?.image ? (
                <img
                  src={item.image}
                  alt={item.name_en}
                  className="h-20 w-20 rounded-md border object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  className="hidden"
                  onChange={(e) => set("image", e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="me-1.5 h-4 w-4" />
                  Choose image
                </Button>
                {values.image && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      set("image", null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <Trash2 className="me-1.5 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Save changes" : "Create item"}
        </Button>
      </div>
    </form>
  );
}
