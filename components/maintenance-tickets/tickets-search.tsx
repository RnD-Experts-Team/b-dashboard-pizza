"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Free-text ticket search.
 *
 * Deliberately NOT Apply-gated, unlike every multi-select in this feature. The
 * gate exists because ticking six checkboxes should not fire six requests; a
 * search box that does nothing until you find a button is the single most
 * confusing control you can give someone who is not comfortable with software.
 * Typing and seeing results is the most familiar interaction there is.
 *
 * It debounces instead, and Enter forces the request immediately rather than
 * waiting out the delay. Requests are aborted by the store, so an overtaken
 * keystroke costs nothing.
 */

const DEBOUNCE_MS = 400;

interface TicketsSearchProps {
  /** The committed value -- what the list is currently filtered by. */
  value: string;
  onChange: (value: string) => void;
  /** True while a request is in flight, so the box can say so. */
  isSearching?: boolean;
  disabled?: boolean;
  className?: string;
}

export function TicketsSearch({
  value,
  onChange,
  isSearching = false,
  disabled = false,
  className,
}: TicketsSearchProps) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The last value we ourselves committed. Lets us tell "the parent changed
   *  the filter" (adopt it) from "our own commit came back" (ignore it, or the
   *  caret jumps while the user is still typing). */
  const committed = useRef(value);

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function commit(next: string) {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = next.trim();
    if (trimmed === committed.current) return;
    committed.current = trimmed;
    onChange(trimmed);
  }

  function handleChange(next: string) {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), DEBOUNCE_MS);
  }

  function handleClear() {
    setDraft("");
    commit("");
  }

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={draft}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          }
          if (e.key === "Escape" && draft) {
            e.preventDefault();
            handleClear();
          }
        }}
        // Says what you can actually type. "Search..." would leave the user
        // guessing which of these the box understands.
        placeholder="Search a store, a ticket number, or the problem"
        aria-label="Search tickets"
        className="h-11 ps-9 pe-20 text-sm"
      />

      <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {isSearching && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
        {draft && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
