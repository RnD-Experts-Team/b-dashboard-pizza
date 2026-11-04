"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RecipientUser } from "@/lib/hooks/use-report-recipients";

interface RecipientsPickerProps {
  /** Everyone that can be picked (empty when the caller may not list users). */
  users: RecipientUser[];
  /** Chosen user ids. */
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  /** The signed-in user, named when the list does not hold them. */
  me?: { id: string; name: string } | null;
  /** Greys the whole picker (the caller may not choose recipients). */
  disabled?: boolean;
  invalid?: boolean;
}

/** A multi-select of users: a searchable checkbox list in a popover, and the chosen people as removable chips. */
export function RecipientsPicker({ users, selected, onChange, loading, me, disabled, invalid }: RecipientsPickerProps) {
  const t = useTranslations("reportBuilder.schedules.dialog");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const chosen = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  const nameOf = (id: string): string => {
    const known = byId.get(id);
    if (known) return known.name;
    if (me && me.id === id) return me.name;
    return t("unknownUser", { id });
  };

  const toggle = (id: string) => onChange(chosen.has(id) ? selected.filter((v) => v !== id) : [...selected, id]);

  return (
    <div className="space-y-2">
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
            aria-invalid={invalid || undefined}
            disabled={disabled || loading}
            className={cn("h-9 w-full justify-between gap-1.5 text-sm font-normal", invalid && "border-destructive")}
          >
            <span className="flex items-center gap-1.5 truncate text-muted-foreground">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loading ? t("recipientsLoading") : selected.length === 0 ? t("recipientsPlaceholder") : t("recipientsSelected", { count: String(selected.length) })}
            </span>
            <ChevronsUpDown className="ms-auto h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("recipientsSearch")}
              className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
              autoFocus
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("recipientsEmpty")}</p>
            ) : (
              filtered.map((u) => {
                const isChosen = chosen.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isChosen && "bg-accent/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        isChosen ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {isChosen && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 truncate">{u.name}</span>
                    <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground" dir="ltr">
                      {u.email}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pe-1 font-normal">
              <span className="max-w-[180px] truncate">{nameOf(id)}</span>
              {me && me.id === id && <span className="text-muted-foreground">({t("you")})</span>}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={t("recipientsRemove", { name: nameOf(id) })}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
