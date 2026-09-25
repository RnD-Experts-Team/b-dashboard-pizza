"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeRoles, splitRoleInput } from "@/lib/workbooks/roles";

interface ChipInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel: string;
  removeLabel: (item: string) => string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  /** Chips area max height — the list scrolls instead of growing the dialog. */
  className?: string;
}

/**
 * Free-text list input: Enter or comma adds, Backspace on empty removes the
 * last chip, a pasted "a, b, c" adds all three. Trim + de-duplicate only —
 * used for role names (which must match pizzasys exactly) and select choices.
 */
export function ChipInput({
  value,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
  invalid,
  disabled,
  id,
  className,
}: ChipInputProps) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const parts = splitRoleInput(raw);
    if (parts.length === 0) return;
    onChange(normalizeRoles([...value, ...parts]));
    setDraft("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",")) commit(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,\n]/.test(text)) {
              e.preventDefault();
              commit(draft + text);
            }
          }}
          className="h-9"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0"
          disabled={disabled || !draft.trim()}
          onClick={() => commit(draft)}
        >
          <Plus className="me-1 h-3.5 w-3.5" />
          {addLabel}
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
          {value.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-[11px] animate-in fade-in-0 zoom-in-95"
            >
              {item}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((v) => v !== item))}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={removeLabel(item)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
