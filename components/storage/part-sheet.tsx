"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Hash, Loader2, Pencil, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { storageService } from "@/lib/api/services/storage.service";
import { usePartPriceHistory, usePartStockAt, useStoragePartUnits } from "@/lib/hooks/use-storage";
import { formatMoney, formatQuantity } from "@/lib/maintenance/money";
import { PART_SERIAL_STATUSES, PART_UNITS, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { partHint } from "@/lib/storage/stock-forms";
import type { StockActionId } from "@/lib/storage/stock-actions";
import { formatTimestamp, formatWireDateTime } from "@/lib/utils/date-display";
import { PartFormDialog } from "./part-form-dialog";
import { RecordStockMenu } from "./record-stock-menu";
import { PlaceBreadcrumb, TBL, TD, TH, signTone } from "./storage-shared";
import type { Part, PartSerialUnit } from "@/types/maintenance-v2";

/**
 * One part: its details (editable), where it is and how many, its serial
 * numbered pieces, and what we have paid for it.
 */

export interface PartSheetProps {
  partId: number | null;
  onOpenChange: (open: boolean) => void;
  parts: readonly Part[];
  onPartSaved: (part: Part) => void;
  onRecord: (id: StockActionId, partId: number) => void;
  canEdit: boolean;
  canRecordMovements: boolean;
  canRecordPayments: boolean;
  revision: number;
}

const SERIAL_TONE: Record<string, string> = {
  in_stock: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  installed: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  returned: "border-border text-muted-foreground",
  damaged_lost: "border-red-500/40 text-red-700 dark:text-red-400",
};

export function PartSheet({
  partId,
  onOpenChange,
  parts,
  onPartSaved,
  onRecord,
  canEdit,
  canRecordMovements,
  canRecordPayments,
  revision,
}: PartSheetProps) {
  const t = useTranslations("maintenanceV2");
  const [editing, setEditing] = useState(false);
  const part = parts.find((p) => p.id === partId) ?? null;
  const unit = vocabText(t, vocabEntry(PART_UNITS, part?.unit ?? "each"));

  return (
    <Sheet open={partId != null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {partId == null ? null : (
          <>
            <SheetHeader className="space-y-1 pe-8">
              <SheetTitle className="font-heading text-lg font-semibold">{part?.name ?? `#${partId}`}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-1.5">
                {part && partHint(part) && <span>{partHint(part)}</span>}
                <Badge variant="outline" className="h-5 text-[10px]">
                  {t("storage.parts.countedIn", { unit })}
                </Badge>
                {part?.trackSerials && (
                  <Badge variant="outline" className="h-5 gap-0.5 text-[10px]">
                    <Hash className="h-2.5 w-2.5" aria-hidden="true" />
                    {t("storage.parts.serialBadge")}
                  </Badge>
                )}
              </SheetDescription>
              <div className="flex flex-wrap gap-2 pt-2">
                <RecordStockMenu
                  onPick={(id) => onRecord(id, partId)}
                  canRecordMovements={canRecordMovements}
                  canRecordPayments={canRecordPayments}
                />
                {canEdit && part && (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {t("storage.parts.editDetails")}
                  </Button>
                )}
              </div>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-6">
              {part && <PartDetails part={part} />}
              <StockByLocation partId={partId} unit={unit} revision={revision} />
              {part?.trackSerials && <SerialUnits partId={partId} canEdit={canEdit} revision={revision} />}
              <PriceHistory partId={partId} unit={unit} revision={revision} />
            </div>

            {part && (
              <PartFormDialog
                open={editing}
                onOpenChange={setEditing}
                part={part}
                catalog={parts}
                onSaved={onPartSaved}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-heading text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function PartDetails({ part }: { part: Part }) {
  const t = useTranslations("maintenanceV2");
  const rows: [string, string | null][] = [
    [t("storage.parts.brand"), part.brand],
    [t("storage.parts.model"), part.model],
    [t("storage.parts.partNumber"), part.partNumber],
    [t("storage.parts.unit"), vocabText(t, vocabEntry(PART_UNITS, part.unit))],
    [t("storage.parts.trackSerials"), part.trackSerials ? t("storage.parts.yes") : t("storage.parts.no")],
  ];
  return (
    <Section title={t("storage.parts.details")}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className={cn("truncate", !value && "text-muted-foreground")}>{value || "—"}</dd>
          </div>
        ))}
        {part.description && (
          <div className="col-span-2">
            <dt className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{t("common.description")}</dt>
            <dd className="whitespace-pre-line">{part.description}</dd>
          </div>
        )}
      </dl>
    </Section>
  );
}

function StockByLocation({ partId, unit, revision }: { partId: number; unit: string; revision: number }) {
  const t = useTranslations("maintenanceV2");
  const { total, locations, isLoading, error } = usePartStockAt(partId, revision);
  return (
    <Section title={t("storage.parts.whereItIs")}>
      {isLoading && !total && <Skeleton className="h-16 w-full" />}
      {error && <p className="text-xs text-destructive">{error.message}</p>}
      {!isLoading && !error && locations.length === 0 && <p className="text-sm text-muted-foreground">{t("storage.parts.noStock")}</p>}
      {locations.length > 0 && (
        <div className="rounded-md border">
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>{t("storage.stock.where")}</th>
                <th className={cn(TH, "text-end")}>{t("stock.onHand")}</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.storageLocationId}>
                  <td className={TD}>
                    <span className="font-medium">{loc.storageLocation?.name}</span>
                    <div>
                      <PlaceBreadcrumb place={loc.place} />
                    </div>
                  </td>
                  <td className={cn(TD, "text-end tabular-nums", signTone(loc.onHand < 0 ? loc.onHand : 0))}>
                    {formatQuantity(loc.onHand)} {unit}
                  </td>
                </tr>
              ))}
            </tbody>
            {total && (
              <tfoot>
                <tr>
                  <td className={cn(TD, "font-semibold")}>
                    {t("common.total")}
                    {total.value != null && (
                      <span className="ms-2 text-[11px] font-normal text-muted-foreground tabular-nums">
                        {t("storage.parts.worth", { value: formatMoney(total.value) })}
                      </span>
                    )}
                  </td>
                  <td className={cn(TD, "text-end font-semibold tabular-nums")}>
                    {formatQuantity(total.onHand)} {unit}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Section>
  );
}

function SerialUnits({ partId, canEdit, revision }: { partId: number; canEdit: boolean; revision: number }) {
  const t = useTranslations("maintenanceV2");
  const locale = useLocale();
  const { units, isLoading, error, setData } = useStoragePartUnits(partId, undefined, true, revision);
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <Section title={t("storage.serials.title")}>
      {isLoading && units.length === 0 && <Skeleton className="h-16 w-full" />}
      {error && <p className="text-xs text-destructive">{error.message}</p>}
      {!isLoading && !error && units.length === 0 && <p className="text-sm text-muted-foreground">{t("storage.serials.none")}</p>}
      {units.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>{t("storage.serials.serial")}</th>
                <th className={TH}>{t("common.status")}</th>
                <th className={TH}>{t("storage.serials.whereNow")}</th>
                <th className={TH}>{t("storage.serials.warranty")}</th>
                {canEdit && <th className={TH}><span className="sr-only">{t("common.edit")}</span></th>}
              </tr>
            </thead>
            <tbody>
              {units.map((unit) =>
                editingId === unit.id ? (
                  <SerialEditRow
                    key={unit.id}
                    unit={unit}
                    onDone={(saved) => {
                      if (saved) setData((prev) => (prev ?? []).map((u) => (u.id === saved.id ? saved : u)));
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <tr key={unit.id}>
                    <td className={cn(TD, "font-mono")}>{unit.serialNumber}</td>
                    <td className={TD}>
                      <Badge variant="outline" className={cn("h-5 text-[10px]", SERIAL_TONE[unit.status])}>
                        {vocabText(t, vocabEntry(PART_SERIAL_STATUSES, unit.status))}
                      </Badge>
                    </td>
                    <td className={TD}>
                      {unit.ticketIssue ? (
                        <Link
                          href={`/${locale}/dashboard/maintenance-tickets/${unit.ticketIssue.ticketId}?issue=${unit.ticketIssue.id}`}
                          className="hover:underline"
                        >
                          {t("storage.issue.line", { ticket: unit.ticketIssue.ticketId, store: unit.ticketIssue.storeNumber ?? "—" })}
                        </Link>
                      ) : (
                        unit.storageLocation?.name ?? "—"
                      )}
                      {unit.installedAt && (
                        <p className="text-[11px] text-muted-foreground">
                          {t("storage.serials.installedOn", { date: formatTimestamp(unit.installedAt, "MMM d, yyyy") })}
                        </p>
                      )}
                    </td>
                    <td className={cn(TD, "tabular-nums")}>{unit.warrantyUntil ? formatWireDateTime(unit.warrantyUntil) : "—"}</td>
                    {canEdit && (
                      <td className={TD}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEditingId(unit.id)}
                          aria-label={t("storage.serials.edit", { serial: unit.serialNumber })}
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function SerialEditRow({ unit, onDone }: { unit: PartSerialUnit; onDone: (saved: PartSerialUnit | null) => void }) {
  const t = useTranslations("maintenanceV2");
  const [serial, setSerial] = useState(unit.serialNumber);
  const [warranty, setWarranty] = useState(unit.warrantyUntil ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!serial.trim()) return;
    setSaving(true);
    try {
      const saved = await storageService.updatePartUnit(unit.id, {
        serialNumber: serial.trim(),
        warrantyUntil: warranty || null,
      });
      toast.success(t("common.saved"));
      onDone(saved);
    } catch (err) {
      if (!isCancelled(err)) toast.error(err instanceof Error ? err.message : t("common.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td className={TD} colSpan={3}>
        <Input
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          className="h-8 font-mono text-xs"
          aria-label={t("storage.serials.serial")}
          autoFocus
        />
      </td>
      <td className={TD}>
        <Input
          type="date"
          value={warranty}
          onChange={(e) => setWarranty(e.target.value)}
          className="h-8 text-xs"
          aria-label={t("storage.serials.warranty")}
        />
      </td>
      <td className={cn(TD, "whitespace-nowrap")}>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void save()} disabled={saving} aria-label={t("common.save")}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Check className="h-3 w-3" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDone(null)} disabled={saving} aria-label={t("common.cancel")}>
          <X className="h-3 w-3" aria-hidden="true" />
        </Button>
      </td>
    </tr>
  );
}

function PriceHistory({ partId, unit, revision }: { partId: number; unit: string; revision: number }) {
  const t = useTranslations("maintenanceV2");
  const { entries, isLoading, error } = usePartPriceHistory(partId, revision);
  return (
    <Section title={t("storage.prices.title")}>
      <p className="text-[11px] text-muted-foreground">{t("storage.prices.help")}</p>
      {isLoading && entries.length === 0 && <Skeleton className="h-16 w-full" />}
      {error && <p className="text-xs text-destructive">{error.message}</p>}
      {!isLoading && !error && entries.length === 0 && <p className="text-sm text-muted-foreground">{t("storage.prices.none")}</p>}
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>{t("common.date")}</th>
                <th className={TH}>{t("storage.stock.where")}</th>
                <th className={cn(TH, "text-end")}>{t("storage.record.quantity")}</th>
                <th className={cn(TH, "text-end")}>{t("storage.prices.each")}</th>
                <th className={cn(TH, "text-end")}>{t("common.total")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={`${entry.stockMovementId}-${entry.storageLocationId}-${entry.receivedAt}`}>
                  <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{formatWireDateTime(entry.receivedAt, { dateTimePattern: "MMM d, yyyy" })}</td>
                  <td className={TD}>{entry.storageLocation?.name ?? "—"}</td>
                  <td className={cn(TD, "text-end tabular-nums")}>
                    {formatQuantity(entry.quantity)} {unit}
                  </td>
                  <td className={cn(TD, "text-end tabular-nums")}>{formatMoney(entry.unitCost)}</td>
                  <td className={cn(TD, "text-end tabular-nums")}>{formatMoney(entry.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
