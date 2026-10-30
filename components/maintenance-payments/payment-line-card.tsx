"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { format, isValid, parseISO } from "date-fns";
import { Check, ChevronDown, ChevronUp, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/maintenance-tickets/form-bits";
import { maintenanceCatalogService } from "@/lib/hooks/use-maintenance-catalog";
import { useMaintenanceMutation } from "@/lib/hooks/use-maintenance-resource";
import { formErrorsFrom, lineErrorKey, type FormErrors } from "@/lib/maintenance-payments/field-errors";
import {
  changeLineType,
  previewLineAmount,
  resetHours,
  setLineSessions,
  typeHours,
  type PaidToChoice,
  type PaymentLineDraft,
  type PreviewContext,
} from "@/lib/maintenance-payments/form-state";
import { LINE_TYPE_ORDER } from "@/lib/maintenance-payments/line-types";
import { formatMoney, parseDecimal } from "@/lib/maintenance/money";
import { findNameClash, tidyName } from "@/lib/maintenance/names";
import {
  PARTS_DESTINATIONS,
  PAYMENT_LINE_TYPES,
  vocabEntry,
  vocabHelp,
  vocabText,
} from "@/lib/maintenance/vocabulary";
import type { Part, PartsDestination, PaymentLineType, Supplier, TechnicianPurchase } from "@/types/maintenance-v2";
import type { StorageLocationRef } from "@/types/maintenance-tickets.types";
import { EntityCombobox } from "./entity-combobox";
import { Field, fieldId } from "./field";
import { LINE_TYPE_ICONS } from "./line-type-badges";
import { MultiCheckSelect } from "./multi-check-select";
import { AddSupplierInline } from "./paid-to-picker";
import { SessionChecklist, type SessionOption } from "./session-checklist";
import { usePlaceLevels, useStoreIssues, type StoreOption } from "./use-payment-lookups";

/** Everything a line card reads that is shared by the whole dialog. */
export interface LineLookups {
  paidTo: PaidToChoice | null;
  stores: StoreOption[];
  storeNumberOf: (id: string | number | null | undefined) => string | null;
  sessions: SessionOption[];
  sessionsLoading: boolean;
  previewCtx: PreviewContext;
  purchases: TechnicianPurchase[];
  parts: Part[];
  partsLoading: boolean;
  onPartCreated: (part: Part) => void;
  suppliers: Supplier[];
  onSupplierCreated: (supplier: Supplier) => void;
  locations: StorageLocationRef[];
  locationsLoading: boolean;
  /** Labels for issues already on a line that the store list may not hold. */
  issueLabels: Record<number, string>;
}

const OTHER_STORE = "__other__";
/** One serial input per piece, up to this many (more is a typing mistake). */
const MAX_SERIAL_INPUTS = 100;

export function PaymentLineCard({
  line,
  index,
  errors,
  lookups,
  sessionsOnOtherLines,
  purchasesOnOtherLines,
  canRemove,
  onChange,
  onRemove,
}: {
  line: PaymentLineDraft;
  index: number;
  errors: FormErrors;
  lookups: LineLookups;
  sessionsOnOtherLines: number[];
  purchasesOnOtherLines: number[];
  canRemove: boolean;
  onChange: (next: PaymentLineDraft, touchedField?: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const [otherMode, setOtherMode] = useState(Boolean(line.otherStore) && line.storeId == null);
  const [showMore, setShowMore] = useState(Boolean(line.description) && line.type !== "other");

  const errKey = (field: string) => lineErrorKey(index, field);
  const err = (...fields: string[]) => fields.map((f) => errors.fields[errKey(f)]).find(Boolean);
  const idOf = (field: string) => fieldId(errKey(field));
  const patch = (p: Partial<PaymentLineDraft>, field?: string) => onChange({ ...line, ...p }, field);

  const isTechnician = lookups.paidTo?.type === "technician";
  const intoStorage = line.type === "parts" && line.destination === "storage";
  const amount = previewLineAmount(line, lookups.previewCtx);
  const typeEntry = vocabEntry(PAYMENT_LINE_TYPES, line.type);
  const TypeIcon = LINE_TYPE_ICONS[line.type];
  const part = lookups.parts.find((p) => p.id === line.partId) ?? null;

  /* ── Type ─────────────────────────────────────────────────────────── */

  const onTypeChange = (type: PaymentLineType) => {
    const rate = type === "hourly" && isTechnician ? lookups.paidTo?.hourlyRate ?? "" : "";
    onChange(changeLineType(line, type, rate), "type");
    setShowMore(false);
  };

  /* ── Store / place ────────────────────────────────────────────────── */

  const storeNumber = lookups.storeNumberOf(line.storeId);
  const chosenStore = line.storeId == null || line.storeId === "" ? null : String(line.storeId);
  const storeGroups = useMemo(
    () => [
      {
        options: [
          ...lookups.stores.map((s) => ({ value: String(s.id), label: s.storeNumber, hint: s.name })),
          { value: OTHER_STORE, label: t("payments.otherStoreOption") },
        ],
      },
    ],
    [lookups.stores, t],
  );

  const storeField = (
    <Field
      htmlFor={idOf("storeId")}
      label={t("common.store")}
      required
      error={err("storeId", "otherStore")}
      help={t("payments.storeHelp")}
    >
      <EntityCombobox
        id={idOf("storeId")}
        groups={storeGroups}
        value={otherMode ? OTHER_STORE : chosenStore}
        onChange={(v) => {
          if (v === OTHER_STORE) {
            setOtherMode(true);
            patch({ storeId: null, ticketIssueIds: [] }, "storeId");
            return;
          }
          setOtherMode(false);
          patch({ storeId: v == null ? null : Number(v), otherStore: "", ticketIssueIds: [] }, "storeId");
        }}
        placeholder={t("payments.storePlaceholder")}
        searchPlaceholder={t("payments.searchStores")}
        emptyText={t("payments.noMatches")}
        invalid={Boolean(err("storeId"))}
      />
      {otherMode && (
        <Input
          id={idOf("otherStore")}
          value={line.otherStore}
          onChange={(e) => patch({ otherStore: e.target.value }, "storeId")}
          placeholder={t("payments.otherStorePlaceholder")}
          aria-label={t("common.otherStore")}
          className="mt-1.5 h-9"
        />
      )}
    </Field>
  );

  /* ── Tickets ──────────────────────────────────────────────────────── */

  const ticketsField = (
    <TicketsField
      line={line}
      storeNumber={otherMode ? null : storeNumber}
      issueLabels={lookups.issueLabels}
      id={idOf("ticketIssueIds")}
      error={err("ticketIssueIds")}
      required={line.type === "parts" && line.destination === "ticket"}
      onChange={(ids) => patch({ ticketIssueIds: ids }, "ticketIssueIds")}
    />
  );

  /* ── Money inputs ─────────────────────────────────────────────────── */

  const moneyInput = (field: keyof PaymentLineDraft & string, label: string, opts: { required?: boolean; help?: string } = {}) => (
    <Field htmlFor={idOf(field)} label={label} required={opts.required} help={opts.help} error={err(field)}>
      <Input
        id={idOf(field)}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={String(line[field] ?? "")}
        onChange={(e) => patch({ [field]: e.target.value } as Partial<PaymentLineDraft>, field)}
        className="h-9 tabular-nums"
        aria-invalid={Boolean(err(field)) || undefined}
      />
    </Field>
  );

  const descriptionField = (required: boolean) => (
    <Field htmlFor={idOf("description")} label={t("common.description")} required={required} error={err("description")}>
      <Textarea
        id={idOf("description")}
        value={line.description}
        onChange={(e) => patch({ description: e.target.value }, "description")}
        rows={2}
        className="min-h-14 text-sm"
        placeholder={required ? t("payments.otherDescriptionPlaceholder") : t("payments.descriptionPlaceholder")}
        aria-invalid={Boolean(err("description")) || undefined}
      />
    </Field>
  );

  const typeOptions = LINE_TYPE_ORDER.map((type) => ({
    type,
    entry: vocabEntry(PAYMENT_LINE_TYPES, type),
    Icon: LINE_TYPE_ICONS[type],
  }));

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-xs",
        Object.keys(errors.fields).some((k) => k.startsWith(`lines.${index}.`)) && "border-destructive/60",
      )}
    >
      {/* Header: type + amount + remove */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Select value={line.type} onValueChange={(v) => onTypeChange(v as PaymentLineType)}>
            <SelectTrigger id={idOf("type")} className="h-9 w-full sm:w-56" aria-label={t("payments.lineType")}>
              <SelectValue>
                <span className="flex items-center gap-2">
                  <TypeIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {vocabText(t, typeEntry)}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map(({ type, entry, Icon }) => (
                <SelectItem key={type} value={type} disabled={type === "hourly" && lookups.paidTo?.type === "supplier"}>
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    {vocabText(t, entry)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{vocabHelp(t, typeEntry)}</p>
          {err("type") && <p className="text-[11px] text-destructive">{err("type")}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-sm font-semibold tabular-nums" aria-label={t("payments.lineAmount")}>
            {formatMoney(amount)}
          </span>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label={t("payments.removeLine", { number: index + 1 })}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* ── Hourly ── */}
        {line.type === "hourly" && (
          <>
            {lookups.paidTo?.type === "supplier" && (
              <p className="text-xs text-destructive sm:col-span-2">{t("payments.hourlyNeedsTechnician")}</p>
            )}
            <div className="sm:col-span-2">{storeField}</div>
            <Field
              className="sm:col-span-2"
              htmlFor={idOf("tripSessionIds")}
              label={t("payments.clockedTime")}
              help={isTechnician ? t("payments.clockedTimeHelp") : t("payments.pickTechnicianFirst")}
              error={err("tripSessionIds")}
              aside={lookups.sessionsLoading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : undefined}
            >
              {isTechnician && (
                <SessionChecklist
                  id={idOf("tripSessionIds")}
                  sessions={lookups.sessions}
                  selected={line.tripSessionIds}
                  lockedIds={sessionsOnOtherLines}
                  invalid={Boolean(err("tripSessionIds"))}
                  onToggle={(sid) => {
                    const ids = line.tripSessionIds.includes(sid)
                      ? line.tripSessionIds.filter((x) => x !== sid)
                      : [...line.tripSessionIds, sid];
                    onChange(setLineSessions(line, ids, lookups.previewCtx), "tripSessionIds");
                  }}
                />
              )}
            </Field>
            <Field
              htmlFor={idOf("hours")}
              label={t("payments.hours")}
              required={!line.tripSessionIds.length}
              error={err("hours")}
              help={line.hoursTyped && line.tripSessionIds.length ? t("payments.typedOverHelp") : undefined}
              aside={
                line.hoursTyped && line.tripSessionIds.length ? (
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="border-amber-500/40 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-400">
                      {t("payments.typedOver")}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => onChange(resetHours(line, lookups.previewCtx), "hours")}
                      className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      {t("payments.useClockedTime")}
                    </button>
                  </span>
                ) : undefined
              }
            >
              <Input
                id={idOf("hours")}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={line.hours}
                onChange={(e) => onChange(typeHours(line, e.target.value), "hours")}
                className="h-9 tabular-nums"
                aria-invalid={Boolean(err("hours")) || undefined}
              />
            </Field>
            {moneyInput("rate", t("payments.rate"), {
              required: true,
              help: lookups.paidTo?.hourlyRate
                ? t("payments.rateHelp", { rate: formatMoney(lookups.paidTo.hourlyRate) })
                : undefined,
            })}
            <div className="sm:col-span-2">{ticketsField}</div>
          </>
        )}

        {/* ── Fixed / inspection ── */}
        {(line.type === "fixed" || line.type === "inspection") && (
          <>
            {storeField}
            {moneyInput("amount", t("common.amount"), { required: true })}
            <div className="sm:col-span-2">{ticketsField}</div>
          </>
        )}

        {/* ── Other ── */}
        {line.type === "other" && (
          <>
            <div className="sm:col-span-2">{descriptionField(true)}</div>
            {storeField}
            {moneyInput("amount", t("common.amount"), { required: true })}
            <div className="sm:col-span-2">{ticketsField}</div>
          </>
        )}

        {/* ── Gas ── */}
        {line.type === "gas" && (
          <>
            <div className="sm:col-span-2">{storeField}</div>
            <Field className="sm:col-span-2" label={t("payments.gasHow")}>
              <Segmented
                value={line.gasMode}
                options={[
                  { value: "amount", label: t("payments.gasAmount") },
                  { value: "miles", label: t("payments.gasMiles") },
                ]}
                onChange={(v) => patch({ gasMode: v }, "amount")}
                className="w-full sm:w-72"
              />
            </Field>
            {line.gasMode === "amount" ? (
              moneyInput("amount", t("common.amount"), { required: true })
            ) : (
              <>
                {moneyInput("miles", t("payments.miles"), { required: true })}
                {moneyInput("rate", t("payments.ratePerMile"), { required: true })}
              </>
            )}
            <div className="sm:col-span-2">{ticketsField}</div>
          </>
        )}

        {/* ── Parts ── */}
        {line.type === "parts" && (
          <PartsFields
            line={line}
            part={part}
            lookups={lookups}
            err={err}
            idOf={idOf}
            patch={patch}
            storeField={storeField}
            ticketsField={ticketsField}
            moneyInput={moneyInput}
            purchasesOnOtherLines={purchasesOnOtherLines}
            isTechnician={isTechnician}
            intoStorage={intoStorage}
          />
        )}

        {/* ── More details: the line's description ── */}
        {line.type !== "other" && (
          <div className="sm:col-span-2">
            {showMore ? (
              descriptionField(false)
            ) : (
              <button
                type="button"
                onClick={() => setShowMore(true)}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ChevronDown className="size-3.5" aria-hidden="true" />
                {t("common.moreDetails")}
              </button>
            )}
            {showMore && !line.description && (
              <button
                type="button"
                onClick={() => setShowMore(false)}
                className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
              >
                <ChevronUp className="size-3.5" aria-hidden="true" />
                {t("common.fewerDetails")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tickets of the line's store ──────────────────────────────────────── */

function TicketsField({
  line,
  storeNumber,
  issueLabels,
  id,
  error,
  required,
  onChange,
}: {
  line: PaymentLineDraft;
  storeNumber: string | null;
  issueLabels: Record<number, string>;
  id: string;
  error?: string;
  required: boolean;
  onChange: (ids: number[]) => void;
}) {
  const t = useTranslations("maintenanceV2");
  const { issues, isLoading, error: loadError, refresh } = useStoreIssues(storeNumber);

  const options = useMemo(() => {
    const listed = issues.map((i) => ({ id: i.id, label: `#${i.ticketId} · ${i.title}`, hint: i.statusLabel ?? undefined }));
    const extra = line.ticketIssueIds
      .filter((x) => !listed.some((o) => o.id === x))
      .map((x) => ({ id: x, label: issueLabels[x] ?? `#${x}` }));
    return [...extra, ...listed];
  }, [issues, line.ticketIssueIds, issueLabels]);

  const help = storeNumber ? t("payments.ticketsHelp") : t("payments.ticketsNeedStore");

  return (
    <Field htmlFor={id} label={t("payments.tickets")} required={required} help={help} error={error}>
      <MultiCheckSelect
        id={id}
        options={options}
        selected={line.ticketIssueIds}
        onChange={onChange}
        placeholder={
          line.ticketIssueIds.length
            ? t("payments.ticketsChosen", { count: line.ticketIssueIds.length })
            : t("payments.ticketsPlaceholder")
        }
        searchPlaceholder={t("payments.searchTickets")}
        emptyText={storeNumber ? t("payments.noTickets") : t("payments.ticketsNeedStore")}
        removeLabel={(label) => t("payments.removeItem", { label })}
        loading={isLoading}
        disabled={!storeNumber && line.ticketIssueIds.length === 0}
        invalid={Boolean(error)}
      />
      {loadError && (
        <button type="button" onClick={() => void refresh()} className="text-[11px] text-destructive hover:underline">
          {t("payments.ticketsLoadError")} {t("common.retry")}
        </button>
      )}
    </Field>
  );
}

/* ── Parts ────────────────────────────────────────────────────────────── */

function PartsFields({
  line,
  part,
  lookups,
  err,
  idOf,
  patch,
  storeField,
  ticketsField,
  moneyInput,
  purchasesOnOtherLines,
  isTechnician,
  intoStorage,
}: {
  line: PaymentLineDraft;
  part: Part | null;
  lookups: LineLookups;
  err: (...fields: string[]) => string | undefined;
  idOf: (field: string) => string;
  patch: (p: Partial<PaymentLineDraft>, field?: string) => void;
  storeField: React.ReactNode;
  ticketsField: React.ReactNode;
  moneyInput: (field: keyof PaymentLineDraft & string, label: string, opts?: { required?: boolean; help?: string }) => React.ReactNode;
  purchasesOnOtherLines: number[];
  isTechnician: boolean;
  intoStorage: boolean;
}) {
  const t = useTranslations("maintenanceV2");

  const partGroups = useMemo(
    () => [
      {
        options: lookups.parts
          .filter((p) => !p.deletedAt || p.id === line.partId)
          .map((p) => ({ value: String(p.id), label: p.name, hint: [p.brand, p.partNumber].filter(Boolean).join(" · ") || undefined })),
      },
    ],
    [lookups.parts, line.partId],
  );

  const supplierGroups = useMemo(
    () => [
      {
        options: lookups.suppliers
          .filter((s) => !s.deletedAt || s.id === line.boughtFromSupplierId)
          .map((s) => ({ value: String(s.id), label: s.name })),
      },
    ],
    [lookups.suppliers, line.boughtFromSupplierId],
  );

  const quantity = parseDecimal(line.quantity) ?? 0;
  const serialCount = part?.trackSerials ? Math.min(MAX_SERIAL_INPUTS, Math.max(0, Math.floor(quantity))) : 0;
  const serials = Array.from({ length: serialCount }, (_, i) => line.serials[i] ?? "");
  const purchases = lookups.purchases;

  const destinationOptions = (Object.keys(PARTS_DESTINATIONS) as PartsDestination[]).map((d) => ({
    value: d,
    label: vocabText(t, vocabEntry(PARTS_DESTINATIONS, d)),
  }));

  return (
    <>
      <Field className="sm:col-span-2" htmlFor={idOf("partId")} label={t("payments.part")} required error={err("partId")}>
        <EntityCombobox
          id={idOf("partId")}
          groups={partGroups}
          value={line.partId == null ? null : String(line.partId)}
          onChange={(v) => patch({ partId: v == null ? null : Number(v), serials: [] }, "partId")}
          placeholder={t("payments.partPlaceholder")}
          searchPlaceholder={t("payments.searchParts")}
          emptyText={t("payments.noMatches")}
          loading={lookups.partsLoading}
          invalid={Boolean(err("partId"))}
          footer={(query, close) => (
            <CreatePartInline
              initialName={query}
              parts={lookups.parts}
              onPicked={(p, created) => {
                if (created) lookups.onPartCreated(p);
                patch({ partId: p.id, serials: [] }, "partId");
                close();
              }}
            />
          )}
        />
      </Field>
      {moneyInput("quantity", t("payments.quantity"), { required: true })}
      {moneyInput("unitCost", t("payments.unitCost"), { required: true })}
      <Field className="sm:col-span-2" htmlFor={idOf("boughtFromSupplierId")} label={t("payments.boughtFrom")} error={err("boughtFromSupplierId")} help={t("payments.boughtFromHelp")}>
        <EntityCombobox
          id={idOf("boughtFromSupplierId")}
          groups={supplierGroups}
          value={line.boughtFromSupplierId == null ? null : String(line.boughtFromSupplierId)}
          onChange={(v) => patch({ boughtFromSupplierId: v == null ? null : Number(v) }, "boughtFromSupplierId")}
          placeholder={t("payments.supplierPlaceholder")}
          searchPlaceholder={t("payments.searchSuppliers")}
          emptyText={t("payments.noMatches")}
          clearLabel={t("payments.clear")}
          footer={(query, close) => (
            <AddSupplierInline
              initialName={query}
              suppliers={lookups.suppliers}
              onCreated={(s) => {
                lookups.onSupplierCreated(s);
                patch({ boughtFromSupplierId: s.id }, "boughtFromSupplierId");
                close();
              }}
              onUseExisting={(s) => {
                patch({ boughtFromSupplierId: s.id }, "boughtFromSupplierId");
                close();
              }}
            />
          )}
        />
      </Field>
      <Field
        className="sm:col-span-2"
        label={t("payments.goesTo")}
        required
        error={err("destination")}
        help={vocabHelp(t, vocabEntry(PARTS_DESTINATIONS, line.destination))}
      >
        <Segmented
          value={line.destination ?? ""}
          options={destinationOptions}
          onChange={(d) => patch({ destination: d }, "destination")}
          className="w-full sm:w-80"
        />
      </Field>
      {intoStorage ? (
        <StorageSpotFields line={line} lookups={lookups} err={err} idOf={idOf} patch={patch} />
      ) : (
        <>
          <div className="sm:col-span-2">{storeField}</div>
          <div className="sm:col-span-2">{ticketsField}</div>
        </>
      )}
      {serialCount > 0 && (
        <Field
          className="sm:col-span-2"
          htmlFor={idOf("serials")}
          label={t("payments.serialNumbers")}
          required
          error={err("serials")}
          help={t("payments.serialsHelp", { count: serialCount })}
        >
          <div className="grid gap-1.5 sm:grid-cols-2">
            {serials.map((value, i) => (
              <Input
                key={i}
                id={i === 0 ? idOf("serials") : undefined}
                value={value}
                onChange={(e) => {
                  const next = [...serials];
                  next[i] = e.target.value;
                  patch({ serials: next }, "serials");
                }}
                placeholder={t("payments.serialPlaceholder", { number: i + 1 })}
                aria-label={t("payments.serialPlaceholder", { number: i + 1 })}
                className="h-8 text-sm"
              />
            ))}
          </div>
        </Field>
      )}
      {isTechnician && (purchases.length > 0 || line.technicianPurchaseIds.length > 0) && (
        <Field
          className="sm:col-span-2"
          htmlFor={idOf("technicianPurchaseIds")}
          label={t("payments.paysBack")}
          error={err("technicianPurchaseIds")}
          help={t("payments.paysBackHelp")}
        >
          <PurchaseChecklist
            id={idOf("technicianPurchaseIds")}
            purchases={purchases}
            selected={line.technicianPurchaseIds}
            lockedIds={purchasesOnOtherLines}
            onToggle={(pid) =>
              patch(
                {
                  technicianPurchaseIds: line.technicianPurchaseIds.includes(pid)
                    ? line.technicianPurchaseIds.filter((x) => x !== pid)
                    : [...line.technicianPurchaseIds, pid],
                },
                "technicianPurchaseIds",
              )
            }
          />
        </Field>
      )}
    </>
  );
}

/* ── Storage spot: location + its place levels ───────────────────────── */

function StorageSpotFields({
  line,
  lookups,
  err,
  idOf,
  patch,
}: {
  line: PaymentLineDraft;
  lookups: LineLookups;
  err: (...fields: string[]) => string | undefined;
  idOf: (field: string) => string;
  patch: (p: Partial<PaymentLineDraft>, field?: string) => void;
}) {
  const t = useTranslations("maintenanceV2");
  const { levels, isLoading } = usePlaceLevels(line.storageLocationId);

  return (
    <>
      <Field
        className="sm:col-span-2"
        htmlFor={idOf("storageLocationId")}
        label={t("payments.storageLocation")}
        required
        error={err("storageLocationId")}
      >
        <Select
          value={line.storageLocationId == null ? "" : String(line.storageLocationId)}
          onValueChange={(v) => patch({ storageLocationId: Number(v), place: [] }, "storageLocationId")}
        >
          <SelectTrigger
            id={idOf("storageLocationId")}
            className={cn("h-9 w-full", err("storageLocationId") && "border-destructive")}
            aria-invalid={Boolean(err("storageLocationId")) || undefined}
          >
            <SelectValue placeholder={lookups.locationsLoading ? t("payments.loading") : t("payments.storageLocationPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {lookups.locations.map((loc) => (
              <SelectItem key={loc.id} value={String(loc.id)}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {line.storageLocationId != null && (isLoading || levels.length > 0) && (
        <Field
          className="sm:col-span-2"
          htmlFor={idOf("place")}
          label={t("payments.storageSpot")}
          error={err("place")}
          help={t("payments.storageSpotHelp")}
          aside={isLoading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : undefined}
        >
          <div className="grid gap-1.5 sm:grid-cols-3">
            {levels.map((level, li) => {
              const chosen = line.place.find((p) => p.levelId === level.id)?.valueId;
              return (
                <Select
                  key={level.id}
                  value={chosen == null ? "" : String(chosen)}
                  onValueChange={(v) =>
                    patch(
                      {
                        place: [
                          ...line.place.filter((p) => p.levelId !== level.id),
                          { levelId: level.id, valueId: Number(v) },
                        ],
                      },
                      "place",
                    )
                  }
                >
                  <SelectTrigger id={li === 0 ? idOf("place") : undefined} className="h-9 w-full" aria-label={level.name}>
                    <SelectValue placeholder={level.name} />
                  </SelectTrigger>
                  <SelectContent>
                    {(level.values ?? [])
                      .filter((v) => !v.deletedAt)
                      .map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {level.name}: {v.value}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              );
            })}
          </div>
        </Field>
      )}
    </>
  );
}

/* ── Technician purchases paid back by this line ────────────────────── */

function PurchaseChecklist({
  id,
  purchases,
  selected,
  lockedIds,
  onToggle,
}: {
  id: string;
  purchases: TechnicianPurchase[];
  selected: number[];
  lockedIds: number[];
  onToggle: (purchaseId: number) => void;
}) {
  const t = useTranslations("maintenanceV2.payments");
  return (
    <div id={id} tabIndex={-1} role="group" className="max-h-44 divide-y overflow-y-auto rounded-md border bg-background">
      {purchases.map((p) => {
        const isOn = selected.includes(p.id);
        const locked = lockedIds.includes(p.id) && !isOn;
        const date = parseISO(p.boughtAt);
        const meta = [
          isValid(date) ? format(date, "MMM d") : null,
          p.supplier?.name,
          p.ticketIssue ? `#${p.ticketIssue.ticketId}` : null,
          locked ? t("onAnotherLine") : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <button
            key={p.id}
            type="button"
            role="checkbox"
            aria-checked={isOn}
            disabled={locked}
            onClick={() => onToggle(p.id)}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors",
              locked ? "cursor-not-allowed opacity-50" : "hover:bg-muted/40",
              isOn && "bg-accent",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                isOn ? "border-primary bg-primary text-primary-foreground" : "border-input",
              )}
            >
              {isOn && <Check className="h-3 w-3" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{p.description}</span>
              {meta && <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>}
            </span>
            <span className="shrink-0 text-xs font-medium tabular-nums">{formatMoney(p.totalCost)}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Create a part from the picker ───────────────────────────────────── */

function CreatePartInline({
  initialName,
  parts,
  onPicked,
}: {
  initialName: string;
  parts: Part[];
  onPicked: (part: Part, created: boolean) => void;
}) {
  const t = useTranslations("maintenanceV2");
  const create = useMaintenanceMutation(maintenanceCatalogService.createPart);
  const [error, setError] = useState<string | null>(null);
  const name = tidyName(initialName);
  const clash = findNameClash(name, parts);

  if (!name) {
    return <p className="px-2 py-1.5 text-[11px] text-muted-foreground">{t("payments.typeToCreatePart")}</p>;
  }
  if (clash) {
    return (
      <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => onPicked(clash, false)}>
        <Check className="h-3.5 w-3.5" />
        {t("payments.useExisting", { name: clash.name })}
      </Button>
    );
  }

  const submit = async () => {
    setError(null);
    try {
      const part = await create.run({ name });
      onPicked(part, true);
    } catch (e) {
      const parsed = formErrorsFrom(e, { rootFields: ["name"] });
      setError(parsed.fields.name ?? parsed.form[0] ?? null);
    }
  };

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-primary"
        disabled={create.isPending}
        onClick={() => void submit()}
      >
        {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {t("payments.createPart", { name })}
      </Button>
      {error && <p className="px-2 pb-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
