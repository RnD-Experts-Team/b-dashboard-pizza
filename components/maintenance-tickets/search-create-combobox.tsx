"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface ComboItem {
  id: number;
  label: string;
}

interface SearchCreateComboboxProps {
  items: ComboItem[];
  selectedId: number | null;
  /** Called when the user picks an existing item or null (clear). */
  onSelect: (id: number | null) => void;
  /**
   * Called when the user triggers "Create X".
   * Should create the item server-side, add it to `items`, and return the new id.
   * Throw (or reject) to surface an error message.
   * Omit to disable inline creation — the user can then only pick from `items`.
   */
  onCreate?: (label: string) => Promise<number>;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}

export function SearchCreateCombobox({
  items,
  selectedId,
  onSelect,
  onCreate,
  placeholder = "Search or create…",
  disabled = false,
  loading = false,
}: SearchCreateComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  // Closed: display selected label; Open: show live query
  const inputValue = open ? query : (selectedItem?.label ?? "");

  const filtered = query.trim()
    ? items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : items;

  const hasExactMatch = items.some(
    (i) => i.label.toLowerCase() === query.trim().toLowerCase()
  );
  const showCreate = open && query.trim().length > 0 && !hasExactMatch && !loading && !!onCreate;

  function handleFocus() {
    // Pre-fill with selected label so user can refine from current selection
    setQuery(selectedItem?.label ?? "");
    setOpen(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setCreateError(null);
    setOpen(true);
  }

  function handleSelect(item: ComboItem) {
    onSelect(item.id);
    setQuery("");
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect(null);
    setQuery("");
    setCreateError(null);
    inputRef.current?.focus();
  }

  async function handleCreate() {
    if (!onCreate || !query.trim() || isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const newId = await onCreate(query.trim());
      onSelect(newId);
      setQuery("");
      setOpen(false);
      // Blur explicitly so Radix's Sheet focus trap doesn't grab the sheet container
      inputRef.current?.blur();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create.");
    } finally {
      setIsCreating(false);
    }
  }

  // Close on outside click/tap
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setQuery(""); inputRef.current?.blur(); }
            if (e.key === "Enter" && showCreate && !isCreating) { e.preventDefault(); handleCreate(); }
            if (e.key === "ArrowDown" && !open) setOpen(true);
          }}
          placeholder={loading ? "Loading…" : placeholder}
          disabled={disabled || loading}
          className="h-8 text-sm pe-7"
          autoComplete="off"
        />
        {selectedItem && !open && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={handleClear}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full top-full mt-1 rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden">
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {query.trim()
                  ? (onCreate ? "No results — type to create a new one" : "No matching issues found")
                  : "No items in catalog"}
              </p>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2",
                  "hover:bg-accent hover:text-accent-foreground",
                  item.id === selectedId && "bg-accent/50"
                )}
                // Prevent the input from blurring before the click registers
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(item)}
              >
                <span className="w-3 shrink-0 flex items-center justify-center">
                  {item.id === selectedId && <Check className="h-3 w-3 text-primary" />}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            ))}
          </div>

          {showCreate && (
            <div className="border-t">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2 text-primary hover:bg-accent hover:text-accent-foreground"
                onPointerDown={(e) => e.preventDefault()}
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating
                  ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  : <Plus className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">
                  {isCreating ? "Creating…" : `Create "${query.trim()}"`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {createError && (
        <p className="text-xs text-destructive mt-1">{createError}</p>
      )}
    </div>
  );
}
