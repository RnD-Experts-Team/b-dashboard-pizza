"use client";

/* eslint-disable @next/next/no-img-element -- local object URLs and same-origin
   /cleaning-storage proxy paths; next/image remote config is unnecessary here. */

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolvePhotoUrl } from "./cleaning-ui";

/**
 * Multi-image picker shared by the Complete-task form and the Grade-item
 * dialog — both endpoints now take an array of files (`photos[]` / `images[]`).
 *
 * Object URLs are derived per render from the File list and revoked on unmount,
 * so callers only own a plain `File[]`.
 */
export function PhotoPicker({
  files,
  onChange,
  existing = [],
  required,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  /** Already-saved photos (relative `/storage/…` URLs), shown read-only above the picker. */
  existing?: string[];
  required?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("cleaningChart.photoPicker");
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<Map<File, string>>(new Map());

  const urlFor = useCallback((file: File) => {
    let url = urlsRef.current.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      urlsRef.current.set(file, url);
    }
    return url;
  }, []);

  // Revoke every object URL we handed out when the picker goes away.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const addFiles = (incoming: FileList | File[] | null) => {
    const next = Array.from(incoming ?? []).filter((f) => f.size > 0);
    if (next.length > 0) onChange([...files, ...next]);
  };

  const removeAt = (index: number) => {
    const file = files[index];
    const url = urlsRef.current.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(file);
    }
    onChange(files.filter((_, i) => i !== index));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData?.items ?? [])
      .filter((it) => it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f != null);
    if (pasted.length > 0) {
      e.preventDefault();
      // Stop here so a host dialog's own dialog-wide paste listener (for
      // pasting while focus is elsewhere, e.g. the note field) doesn't also
      // fire and add the same image twice.
      e.stopPropagation();
      addFiles(pasted);
      toast.success(t("pasted"));
    }
  };

  return (
    <div className="space-y-2" onPaste={handlePaste}>
      {existing.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {existing.map((src, i) => (
            <img
              key={`${src}-${i}`}
              src={resolvePhotoUrl(src)}
              alt={t("savedAlt", { n: i + 1 })}
              className="h-16 w-16 rounded-md border object-cover"
            />
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="relative">
              <img
                src={urlFor(file)}
                alt={file.name}
                className="h-16 w-16 rounded-md border object-cover"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeAt(i)}
                aria-label={t("remove", { name: file.name })}
                className="absolute -end-1.5 -top-1.5 rounded-full border bg-background p-0.5 text-muted-foreground shadow-sm hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          // Reset so picking the same file twice still fires onChange.
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className={cn("w-full", required && files.length === 0 && "border-dashed")}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="me-2 h-4 w-4" />
        {files.length > 0 ? t("addMore") : t("choose")}
      </Button>
    </div>
  );
}
