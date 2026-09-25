"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BreakTypesEmpty } from "./break-type-picker";

export interface BreakTypeOption {
  id: number;
  name: string;
  /** Catalogue order already puts counted types first; this only drives the hint. */
  counted: boolean;
  requiresCustomLabel: boolean;
  retired: boolean;
}

/**
 * Break-type picker with search. The list is sized to show five rows and
 * scrolls for the rest; "Not counted" types carry a quiet hint instead of a
 * group header, so the five visible rows are always five real choices.
 */
export function BreakTypeCombobox({
  id,
  options,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id?: string;
  options: BreakTypeOption[];
  value: number | null;
  onChange: (option: BreakTypeOption) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("breaks");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? options.filter((o) => o.name.toLocaleLowerCase().includes(q)) : options;
  }, [options, query]);

  // Fresh search each time it opens, starting on the current choice.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.id === value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(option: BreakTypeOption) {
    onChange(option);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[active];
      if (option) choose(option);
    }
  }

  const listId = id ? `${id}-list` : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="h-9 w-full justify-between gap-2 font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : t("timer.pickType")}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-56 p-0"
        align="start"
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t("entry.searchType")}
            aria-label={t("entry.searchType")}
            aria-controls={listId}
            aria-activedescendant={
              filtered[active] && listId ? `${listId}-${filtered[active].id}` : undefined
            }
            className="h-10 border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        {options.length === 0 ? (
          <BreakTypesEmpty className="p-3" />
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t("entry.noTypeMatch")}
          </p>
        ) : (
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            // Five 2rem rows + padding; the rest scroll.
            className="max-h-[10.5rem] overflow-y-auto p-1"
            // Dialog's scroll lock swallows wheel events inside portaled popovers.
            onWheel={(e) => e.stopPropagation()}
          >
            {filtered.map((o, i) => {
              const isSelected = o.id === value;
              return (
                <button
                  key={o.id}
                  id={listId ? `${listId}-${o.id}` : undefined}
                  data-index={i}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(o)}
                  onMouseMove={() => setActive(i)}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-start text-sm",
                    i === active && "bg-accent text-accent-foreground"
                  )}
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex-1 truncate">{o.name}</span>
                  {!o.counted && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("timer.excluded")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
