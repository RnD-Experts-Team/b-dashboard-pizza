"use client";

import { useState } from "react";
import { Hash, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoragePartUnits } from "@/lib/hooks/use-storage";
import { PART_SERIAL_STATUSES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import type { StockFlow } from "@/lib/storage/stock-forms";

/**
 * Which serial-numbered pieces a movement carries (one serial per piece).
 *
 * - Leaving a location (used, damaged or lost, moved): tick the pieces that
 *   are in stock THERE — nothing else can leave it.
 * - Arriving (returned, opening stock): type each serial, or tap one we
 *   already know that is not in stock now (e.g. one installed on a ticket).
 */

export interface SerialPickerProps {
  partId: number | null;
  flow: StockFlow;
  /** The location the pieces leave (out / move). */
  locationId: number | null;
  value: string[];
  onChange: (serials: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
}

export function SerialPicker(props: SerialPickerProps) {
  return props.flow === "in" ? <IncomingSerials {...props} /> : <OutgoingSerials {...props} />;
}

function OutgoingSerials({ partId, locationId, value, onChange, invalid, describedBy }: SerialPickerProps) {
  const t = useTranslations("maintenanceSystem");
  const { units, isLoading } = useStoragePartUnits(partId, "in_stock", Boolean(locationId));
  const here = units.filter((u) => u.storageLocation?.id === locationId);

  if (!locationId) return <p className="text-xs text-muted-foreground">{t("storage.serials.pickLocationFirst")}</p>;
  if (isLoading && units.length === 0) return <Skeleton className="h-16 w-full" />;
  if (here.length === 0) return <p className="text-xs text-muted-foreground">{t("storage.serials.noneHere")}</p>;

  function toggle(serial: string, on: boolean) {
    onChange(on ? [...value, serial] : value.filter((s) => s !== serial));
  }

  return (
    <div
      role="group"
      aria-describedby={describedBy}
      className={cn("max-h-44 space-y-1 overflow-y-auto rounded-md border p-2", invalid && "border-destructive")}
    >
      {here.map((unit) => {
        const checked = value.includes(unit.serialNumber);
        const id = `serial-${unit.id}`;
        return (
          <label key={unit.id} htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/60">
            <Checkbox id={id} checked={checked} onCheckedChange={(v) => toggle(unit.serialNumber, v === true)} />
            <Hash className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <span className="font-mono text-xs">{unit.serialNumber}</span>
            {unit.warrantyUntil && (
              <span className="ms-auto text-[11px] text-muted-foreground">
                {t("storage.serials.warrantyUntil", { date: unit.warrantyUntil })}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function IncomingSerials({ partId, value, onChange, invalid, describedBy }: SerialPickerProps) {
  const t = useTranslations("maintenanceSystem");
  const [draft, setDraft] = useState("");
  const { units } = useStoragePartUnits(partId);
  const known = units.filter((u) => u.status !== "in_stock" && !value.includes(u.serialNumber));

  function add(raw: string) {
    const serial = raw.trim();
    if (!serial || value.includes(serial)) return;
    onChange([...value, serial]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={t("storage.serials.typePlaceholder")}
          aria-label={t("storage.serials.typeLabel")}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="h-9 font-mono text-sm"
        />
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => add(draft)} disabled={!draft.trim()}>
          <Plus className="me-1 h-3.5 w-3.5" aria-hidden="true" />
          {t("common.add")}
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((serial) => (
            <Badge key={serial} variant="secondary" className="gap-1 font-mono">
              {serial}
              <button
                type="button"
                onClick={() => onChange(value.filter((s) => s !== serial))}
                aria-label={t("storage.serials.remove", { serial })}
                className="rounded-full hover:text-destructive"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {known.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">{t("storage.serials.knownHelp")}</p>
          <div className="flex flex-wrap gap-1">
            {known.map((unit) => (
              <button
                key={unit.id}
                type="button"
                onClick={() => add(unit.serialNumber)}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                <span className="font-mono">{unit.serialNumber}</span>
                <span className="text-muted-foreground">· {vocabText(t, vocabEntry(PART_SERIAL_STATUSES, unit.status))}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
