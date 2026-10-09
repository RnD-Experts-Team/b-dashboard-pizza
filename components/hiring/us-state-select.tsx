"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { US_STATES } from "@/lib/us-states";

/** Address state picker. Emits the USPS code ("OH"), the only form TCP accepts. */
export function UsStateSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select state" />
      </SelectTrigger>
      <SelectContent>
        {US_STATES.map((s) => (
          <SelectItem key={s.code} value={s.code}>
            {s.code} — {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
