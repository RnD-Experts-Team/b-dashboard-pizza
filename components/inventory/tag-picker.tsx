"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useKnownItemTags } from "@/lib/store/inventory-tags.store";
import type { ItemTagInput } from "@/types/inventory.types";

const DATALIST_ID = "known-item-tags";

/**
 * Multi-tag input for the Item form. There is no tags list endpoint, so
 * suggestions come from `useKnownItemTags()` (tags seen on items already
 * loaded elsewhere in the app this session). Typing an English name that
 * matches a known tag (case-insensitive) adds it immediately — the backend
 * reuses that tag by name_en and ignores whatever ar/es we send for a match.
 * A name that doesn't match any known tag is a new tag, so name_ar/name_es
 * are required before it can be added.
 */
export function TagPicker({
  tags,
  onChange,
}: {
  tags: ItemTagInput[];
  onChange: (tags: ItemTagInput[]) => void;
}) {
  const knownTags = useKnownItemTags();
  const [draftEn, setDraftEn] = useState("");
  const [draftAr, setDraftAr] = useState("");
  const [draftEs, setDraftEs] = useState("");

  const trimmedEn = draftEn.trim();
  const matched = trimmedEn
    ? knownTags.find((t) => t.name_en.toLowerCase() === trimmedEn.toLowerCase())
    : undefined;
  const isNew = trimmedEn.length > 0 && !matched;
  const alreadyAdded =
    trimmedEn.length > 0 &&
    tags.some((t) => t.name_en.toLowerCase() === trimmedEn.toLowerCase());

  const canAdd =
    trimmedEn.length > 0 &&
    !alreadyAdded &&
    (Boolean(matched) || (draftAr.trim().length > 0 && draftEs.trim().length > 0));

  const resetDraft = () => {
    setDraftEn("");
    setDraftAr("");
    setDraftEs("");
  };

  const addTag = () => {
    if (!canAdd) return;
    const tag: ItemTagInput = matched
      ? { name_en: matched.name_en, name_ar: matched.name_ar, name_es: matched.name_es }
      : { name_en: trimmedEn, name_ar: draftAr.trim(), name_es: draftEs.trim() };
    onChange([...tags, tag]);
    resetDraft();
  };

  const removeTag = (index: number) => onChange(tags.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags added yet.</p>
        ) : (
          tags.map((tag, i) => (
            <Badge key={`${tag.name_en}-${i}`} variant="secondary" className="gap-1 pe-1">
              {tag.name_en}
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="ms-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${tag.name_en}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
        <Input
          value={draftEn}
          onChange={(e) => setDraftEn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          list={DATALIST_ID}
          placeholder="Tag name (English)…"
        />
        <Button type="button" variant="outline" onClick={addTag} disabled={!canAdd}>
          <Plus className="me-1.5 h-4 w-4" />
          Add
        </Button>
      </div>
      <datalist id={DATALIST_ID}>
        {knownTags.map((t) => (
          <option key={t.id} value={t.name_en} />
        ))}
      </datalist>

      {isNew && !alreadyAdded && (
        <div className="grid gap-4 rounded-lg border border-dashed p-3 sm:grid-cols-2">
          <p className="text-xs text-muted-foreground sm:col-span-2">
            &ldquo;{trimmedEn}&rdquo; is a new tag — provide its Arabic and Spanish names too.
          </p>
          <div className="space-y-2">
            <Label htmlFor="tag_name_ar">
              Name (AR) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tag_name_ar"
              dir="rtl"
              value={draftAr}
              onChange={(e) => setDraftAr(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag_name_es">
              Name (ES) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tag_name_es"
              value={draftEs}
              onChange={(e) => setDraftEs(e.target.value)}
            />
          </div>
        </div>
      )}

      {matched && !alreadyAdded && (
        <p className="text-xs text-muted-foreground">
          Matches existing tag — {matched.name_ar} / {matched.name_es}.
        </p>
      )}
      {alreadyAdded && (
        <p className="text-xs text-destructive">This tag is already added.</p>
      )}
    </div>
  );
}
