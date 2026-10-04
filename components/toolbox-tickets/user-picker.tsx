"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Hash, Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { userService } from "@/lib/api/services/user.service";
import { useDebouncedValue } from "@/lib/hooks/use-toolbox-tickets-poll";

export interface PickedUser {
  id: number;
  name: string | null;
  email?: string | null;
}

interface TicketUserPickerProps {
  value: PickedUser | null;
  onChange: (user: PickedUser) => void;
  /** Hidden from the list — e.g. the reporter (the API 422s on them). */
  excludeIds?: number[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Extra classes for the dropdown panel (e.g. a z-index inside a raised dialog). */
  contentClassName?: string;
}

/**
 * Searchable, fixed-height people picker over the users directory
 * (`GET /users`, server-side search). Same visual language as
 * SearchableSelect. If the directory isn't readable for this account, typing
 * a numeric id still works — the ticket API validates it either way.
 */
export function TicketUserPicker({
  value,
  onChange,
  excludeIds = [],
  placeholder,
  disabled,
  className,
  contentClassName,
}: TicketUserPickerProps) {
  const t = useTranslations("toolboxTickets.userPicker");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 300);
  const [results, setResults] = useState<PickedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    userService
      .getUsers({ search: debounced || undefined, perPage: 30 })
      .then((res) => {
        if (cancelled) return;
        setResults(
          res.data
            .map((u) => ({ id: Number(u.id), name: u.name, email: u.email }))
            .filter((u) => Number.isFinite(u.id)),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  const excluded = new Set(excludeIds);
  const visible = results.filter((u) => !excluded.has(u.id));
  const numericId = /^\d{1,12}$/.test(query.trim()) ? Number(query.trim()) : null;
  const showIdOption =
    numericId !== null && !excluded.has(numericId) && !visible.some((u) => u.id === numericId);

  const pick = (user: PickedUser) => {
    onChange(user);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between gap-1.5 text-sm font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {value ? value.name || t("userId", { id: value.id }) : placeholder ?? t("placeholder")}
          </span>
          <ChevronsUpDown className="ms-auto h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-[var(--radix-popover-trigger-width)] min-w-60 p-0", contentClassName)}
        align="start"
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
            autoFocus
          />
          {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
        </div>
        {/* Fixed 240px — the app-wide dropdown height (see SearchableSelect). */}
        <div className="max-h-[240px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
          {showIdOption && (
            <button
              type="button"
              onClick={() => pick({ id: numericId!, name: null })}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{t("useId", { id: numericId! })}</span>
            </button>
          )}
          {failed ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">{t("unavailable")}</p>
          ) : !loading && visible.length === 0 && !showIdOption ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            visible.map((u) => {
              const selected = value?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => pick(u)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    selected && "bg-accent/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{u.name}</span>
                    {u.email && <span className="block truncate text-[11px] text-muted-foreground">{u.email}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">#{u.id}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
