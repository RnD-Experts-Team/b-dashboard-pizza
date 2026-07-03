"use client";

import { Store } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useInventoryStores } from "@/lib/hooks/use-inventory-stores";

/**
 * Store picker for the store-scoped inventory pages (Links & Entries).
 *
 * The value exposed is the store identifier string (e.g. "03795-00002").
 * This is the auth service's store.id string PK, which is also the inventory
 * backend's stores.id (synced via NATS) and the hiring API's store_number.
 * All three services use the same string — no translation needed.
 */
export function StorePicker({
  value,
  onChange,
  label = "Store",
  disabled,
}: {
  value: string;
  onChange: (storeId: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const { stores, isLoading } = useInventoryStores();

  // Quick-pick — value is s.storeId (e.g. "03795-00002"), which is also the
  // inventory backend's stores.id primary key (synced via NATS from the auth service).
  const options = stores.map((s) => ({
    value: s.storeId ?? s.id,
    label: `${s.name} — ${s.storeId}`,
  }));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchableSelect
          className="sm:w-64"
          options={options}
          value={value}
          onChange={onChange}
          icon={<Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          placeholder={isLoading ? "Loading stores…" : "Pick a store…"}
          searchPlaceholder="Search stores…"
          emptyText="No stores found."
          disabled={disabled}
          loading={isLoading}
        />

        {/* Manual override for when the store isn't in the dropdown */}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 03795-00002"
          className="flex-1"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
