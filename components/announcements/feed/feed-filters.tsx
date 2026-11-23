"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { KNOWN_ANNOUNCEMENT_TYPES, type AnnouncementType } from "@/types/announcement.types";

export type TypeFilter = "all" | AnnouncementType;

/** How many posts of each type the feed holds (for the counts next to the filter). */
export type TypeCounts = Record<TypeFilter, number>;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Search                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface FeedSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** A shorter placeholder, for a narrow field. */
  short?: boolean;
  className?: string;
}

/** The search box: a magnifier, the field, and an X that clears it. */
export function FeedSearch({ value, onChange, short = false, className }: FeedSearchProps) {
  const t = useTranslations("announcements.page.search");

  return (
    <div className={cn("relative min-w-0", className)}>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={short ? t("short") : t("placeholder")}
        aria-label={t("label")}
        autoComplete="off"
        enterKeyHint="search"
        className="ps-9 pe-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("clear")}
          className="absolute end-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Type filter                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface TypeFilterProps {
  value: TypeFilter;
  onChange: (value: TypeFilter) => void;
  counts: TypeCounts;
  className?: string;
}

const OPTIONS: readonly TypeFilter[] = ["all", ...KNOWN_ANNOUNCEMENT_TYPES];

/** A dropdown, for the narrow page. */
export function TypeFilterSelect({ value, onChange, counts, className }: TypeFilterProps) {
  const t = useTranslations("announcements");
  const label = (type: TypeFilter) => (type === "all" ? t("page.type.all") : t(`types.${type}`));

  return (
    <Select value={value} onValueChange={(next) => onChange(next as TypeFilter)}>
      <SelectTrigger aria-label={t("page.type.label")} className={cn("min-w-0", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((type) => (
          <SelectItem key={type} value={type}>
            {label(type)} ({counts[type]})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A list of buttons with counts, for the side panel. */
export function TypeFilterList({ value, onChange, counts, className }: TypeFilterProps) {
  const t = useTranslations("announcements");
  const label = (type: TypeFilter) => (type === "all" ? t("page.type.all") : t(`types.${type}`));

  return (
    <div
      role="group"
      aria-label={t("page.type.label")}
      className={cn("space-y-0.5", className)}
    >
      {OPTIONS.map((type) => (
        <button
          key={type}
          type="button"
          aria-pressed={value === type}
          onClick={() => onChange(type)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden motion-reduce:transition-none",
            value === type
              ? "bg-secondary font-medium text-secondary-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          {label(type)}
          <span className="text-xs tabular-nums">{counts[type]}</span>
        </button>
      ))}
    </div>
  );
}
