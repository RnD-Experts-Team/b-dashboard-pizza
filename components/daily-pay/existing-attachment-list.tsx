"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import type { ExistingAttachmentForm } from "@/lib/daily-pay/entry-form-state";

/**
 * The files already on a saved payment or line, in edit mode.
 *
 * Each is kept unless unticked. They used to be missing from the edit form
 * altogether -- and every save threw them away, because the form had no way to
 * say "keep this one". Now they travel back by id and survive the save.
 */
export function ExistingAttachmentList({
  items,
  onChange,
  disabled,
}: {
  items: ExistingAttachmentForm[];
  onChange: (items: ExistingAttachmentForm[]) => void;
  disabled?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">Already attached</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={item.attachment.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs",
              item.keep ? "bg-card" : "bg-muted/40",
            )}
          >
            <a
              href={item.attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex min-w-0 items-center gap-1.5 hover:underline",
                !item.keep && "text-muted-foreground line-through",
              )}
              title={`Open ${item.attachment.fileName}`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.attachment.fileName}</span>
            </a>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
              <Checkbox
                checked={item.keep}
                onCheckedChange={(checked) =>
                  onChange(items.map((it, idx) => (idx === i ? { ...it, keep: checked === true } : it)))
                }
                disabled={disabled}
              />
              Keep
            </label>
          </li>
        ))}
      </ul>
      {items.some((i) => !i.keep) && (
        <p className="text-[11px] text-destructive">Unticked files are removed from the sheet when you save.</p>
      )}
    </div>
  );
}
