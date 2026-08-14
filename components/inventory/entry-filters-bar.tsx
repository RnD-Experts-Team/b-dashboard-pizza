"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Pencil,
  Tag,
  Tags,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKnownItemTags } from "@/lib/store/inventory-tags.store";
import type { EntryListParams, InventoryType } from "@/types/inventory.types";

/** Text field that commits on blur/Enter (not per-keystroke). */
function SubmittedByField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setLocal(value);
  }, [editing, value]);

  function commit() {
    onChange(local.trim());
  }

  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={() => {
        setEditing(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setLocal(value);
          e.currentTarget.blur();
        }
      }}
      placeholder="Search name…"
      disabled={disabled}
      className={cn("h-9 text-sm", value && "border-primary/40 bg-primary/5")}
    />
  );
}

interface EntryFiltersBarProps {
  /** Controlled open state — managed by the parent page. */
  open: boolean;
  filters: EntryListParams;
  onFiltersChange: (filters: EntryListParams) => void;
  disabled?: boolean;
}

/** Collapsible filter panel for the Entries list. The toggle button lives in the page header row. */
export function EntryFiltersBar({
  open,
  filters,
  onFiltersChange,
  disabled,
}: EntryFiltersBarProps) {
  const knownTags = useKnownItemTags();

  function updateField<K extends keyof EntryListParams>(
    key: K,
    value: EntryListParams[K]
  ) {
    onFiltersChange({ ...filters, [key]: value, page: 1 });
  }

  if (!open) return null;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            Date from
          </label>
          <DatePicker
            value={filters.date_from ?? ""}
            onChange={(v) => updateField("date_from", v || undefined)}
            placeholder="YYYY-MM-DD"
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            Date to
          </label>
          <DatePicker
            value={filters.date_to ?? ""}
            onChange={(v) => updateField("date_to", v || undefined)}
            placeholder="YYYY-MM-DD"
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Tag className="h-3 w-3" />
            Type
          </label>
          <Select
            value={filters.type ?? "all"}
            onValueChange={(v) =>
              updateField("type", v === "all" ? undefined : (v as InventoryType))
            }
            disabled={disabled}
          >
            <SelectTrigger
              className={cn("h-9 text-sm", filters.type && "border-primary/40 bg-primary/5")}
            >
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="period">Period</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Tags className="h-3 w-3" />
            Category
          </label>
          <Select
            value={filters.tag_id !== undefined ? String(filters.tag_id) : "all"}
            onValueChange={(v) =>
              updateField("tag_id", v === "all" ? undefined : Number(v))
            }
            disabled={disabled || knownTags.length === 0}
          >
            <SelectTrigger
              className={cn(
                "h-9 text-sm",
                filters.tag_id !== undefined && "border-primary/40 bg-primary/5"
              )}
            >
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {knownTags.map((tag) => (
                <SelectItem key={tag.id} value={String(tag.id)}>
                  {tag.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <User className="h-3 w-3" />
            Submitted by
          </label>
          <SubmittedByField
            value={filters.submitted_by ?? ""}
            onChange={(v) => updateField("submitted_by", v || undefined)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Pencil className="h-3 w-3" />
            Edited
          </label>
          <Select
            value={filters.edited === undefined ? "all" : String(filters.edited)}
            onValueChange={(v) =>
              updateField("edited", v === "all" ? undefined : v === "true")
            }
            disabled={disabled}
          >
            <SelectTrigger
              className={cn(
                "h-9 text-sm",
                filters.edited !== undefined && "border-primary/40 bg-primary/5"
              )}
            >
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Edited only</SelectItem>
              <SelectItem value="false">Not edited</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

/** Returns the number of active filters — use on the external toggle button. */
export function countEntryFilters(filters: EntryListParams): number {
  return [
    filters.date_from,
    filters.date_to,
    filters.type,
    filters.submitted_by,
    filters.edited,
    filters.tag_id,
  ].filter((v) => v != null && v !== "").length;
}
