"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorSwatch, LogoThumb } from "@/components/shirts/shirt-ui";
import type { ShirtColor, ShirtLogo } from "@/types/shirt-milestone.types";

/**
 * Dropdowns for the shirt entry form. The catalogue has ~20 logos, so the old
 * button grids made the dialog scroll for pages; a Select keeps each field to
 * one row. Each option carries its swatch / thumbnail, and Radix renders the
 * chosen option's content in the trigger too, so the pick stays visible.
 *
 * Values are the catalogue ids as strings (Radix Select only holds strings);
 * "" is "nothing picked" and shows the placeholder.
 */

/**
 * Cap the open list at 18rem so a long catalogue scrolls instead of filling the
 * screen — but never taller than the room Radix measured. A plain `max-h-72`
 * would replace SelectContent's own `max-h-(--radix-select-content-available-height)`
 * (tailwind-merge treats them as one rule), so both limits go in one value.
 */
const LIST_CLASS =
  "max-h-[min(18rem,var(--radix-select-content-available-height))]";

interface SelectShellProps<T extends { id: number }> {
  /** Lets a <Label htmlFor> point at the trigger. */
  id?: string;
  items: T[];
  value: number | null;
  onChange: (id: number) => void;
  loading?: boolean;
  placeholder: string;
  /** Shown (disabled) when the catalogue has nothing to offer. */
  emptyText: string;
  renderItem: (item: T) => React.ReactNode;
}

function SelectShell<T extends { id: number }>({
  id,
  items,
  value,
  onChange,
  loading,
  placeholder,
  emptyText,
  renderItem,
}: SelectShellProps<T>) {
  if (loading) return <Skeleton className="h-9 w-full" />;

  const empty = items.length === 0;

  return (
    <Select
      value={value === null ? "" : String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={empty}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={empty ? emptyText : placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className={LIST_CLASS}>
        {items.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {renderItem(item)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface ColorSelectProps {
  id?: string;
  colors: ShirtColor[];
  value: number | null;
  onChange: (id: number) => void;
  loading?: boolean;
  placeholder?: string;
  /** Shown (disabled) when `colors` is empty. */
  emptyText?: string;
}

export function ColorSelect({
  id,
  colors,
  value,
  onChange,
  loading,
  placeholder = "Select a colour",
  emptyText = "No active colours in the catalog",
}: ColorSelectProps) {
  return (
    <SelectShell
      id={id}
      items={colors}
      value={value}
      onChange={onChange}
      loading={loading}
      placeholder={placeholder}
      emptyText={emptyText}
      renderItem={(c) => (
        <>
          <ColorSwatch hex={c.hex_code} name={c.name} />
          <span className="truncate">{c.name}</span>
        </>
      )}
    />
  );
}

export interface LogoSelectProps {
  id?: string;
  logos: ShirtLogo[];
  value: number | null;
  onChange: (id: number) => void;
  loading?: boolean;
  placeholder?: string;
}

export function LogoSelect({
  id,
  logos,
  value,
  onChange,
  loading,
  placeholder = "Select a logo",
}: LogoSelectProps) {
  return (
    <SelectShell
      id={id}
      items={logos}
      value={value}
      onChange={onChange}
      loading={loading}
      placeholder={placeholder}
      emptyText="No active logos in the catalog"
      renderItem={(l) => (
        <>
          <LogoThumb logo={l} />
          <span className="truncate">{l.name}</span>
        </>
      )}
    />
  );
}
