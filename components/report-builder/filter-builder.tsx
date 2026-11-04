"use client";

import { useMemo, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/shared/multi-select";
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  isFormulaColumn,
  isFormulaFilter,
  type FilterOp,
  type ReportColumn,
  type ReportFilter,
} from "@/lib/report-builder/definition";
import type { CatalogOption } from "@/types/report-builder.types";
import type { ColumnSource } from "./column-picker";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Filters: on any filterable column of the chosen datasets (sent to that    */
/*  service with the query) or on a formula column (applied by Data after the */
/*  merge). Ops per type follow the contract; enum options come from the      */
/*  catalog; date columns get date pickers.                                   */
/* ────────────────────────────────────────────────────────────────────────── */

type ValueKind = "none" | "enum" | "enumMulti" | "date" | "dateRange" | "number" | "numberRange" | "numberList" | "text" | "textList" | "boolean";

const OPS_BY_TYPE: Record<string, readonly FilterOp[]> = {
  enum: ["eq", "neq", "in", "not_in", "is_null", "not_null"],
  string: ["eq", "neq", "contains", "in", "not_in", "is_null", "not_null"],
  integer: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "not_in", "is_null", "not_null"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_null", "not_null"],
  money: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_null", "not_null"],
  date: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_null", "not_null"],
  datetime: ["gt", "gte", "lt", "lte", "between", "is_null", "not_null"],
  boolean: ["eq", "neq", "is_null", "not_null"],
};

const NULL_OPS: ReadonlySet<FilterOp> = new Set(["is_null", "not_null"]);
const LIST_OPS: ReadonlySet<FilterOp> = new Set(["in", "not_in"]);
const NUMERIC: ReadonlySet<string> = new Set(["integer", "number", "money"]);
const DATES: ReadonlySet<string> = new Set(["date", "datetime"]);

function valueKind(type: string, op: FilterOp): ValueKind {
  if (NULL_OPS.has(op)) return "none";
  const list = LIST_OPS.has(op);
  const range = op === "between";
  const rules: [boolean, ValueKind][] = [
    [type === "enum" && list, "enumMulti"],
    [type === "enum", "enum"],
    [type === "boolean", "boolean"],
    [DATES.has(type) && range, "dateRange"],
    [DATES.has(type), "date"],
    [NUMERIC.has(type) && range, "numberRange"],
    [NUMERIC.has(type) && list, "numberList"],
    [NUMERIC.has(type), "number"],
    [list, "textList"],
  ];
  return rules.find(([test]) => test)?.[1] ?? "text";
}

/** A sensible empty value for a kind, so switching op never leaves a stale shape. */
const EMPTY_VALUE: Record<ValueKind, ReportFilter["value"]> = {
  none: null,
  enum: "",
  enumMulti: [],
  date: "",
  dateRange: ["", ""],
  number: "",
  numberRange: ["", ""],
  numberList: [],
  text: "",
  textList: [],
  boolean: true,
};

interface Target {
  value: string;
  label: string;
  hint: string;
  type: string;
  options?: CatalogOption[];
  filter: { alias: string; column: string } | { id: string };
}

const targetKey = (f: ReportFilter) => (isFormulaFilter(f) ? `f:${f.id}` : `d:${f.alias}:${f.column}`);

interface FilterBuilderProps {
  filters: ReportFilter[];
  sources: ColumnSource[];
  /** Report columns, for filters on formula columns. */
  columns: ReportColumn[];
  errors: Record<number, string>;
  onChange: (next: ReportFilter[]) => void;
  disabled?: boolean;
}

export function FilterBuilder({ filters, sources, columns, errors, onChange, disabled }: FilterBuilderProps) {
  const t = useTranslations("reportBuilder.filters");

  const targets = useMemo<Target[]>(() => {
    const datasetTargets = sources.flatMap((s) =>
      s.dataset.columns
        .filter((c) => c.filterable !== false)
        .map((c) => ({
          value: `d:${s.ref.alias}:${c.key}`,
          label: c.label ?? c.key,
          hint: `${s.ref.alias} · ${s.dataset.label}`,
          type: c.type,
          options: c.options,
          filter: { alias: s.ref.alias, column: c.key },
        })),
    );
    const formulaTargets = columns.filter(isFormulaColumn).map((c) => ({
      value: `f:${c.id}`,
      label: c.label,
      hint: `${c.id} · ${t("formula")}`,
      type: c.type,
      filter: { id: c.id },
    }));
    return [...datasetTargets, ...formulaTargets];
  }, [sources, columns, t]);

  const byKey = useMemo(() => new Map(targets.map((x) => [x.value, x])), [targets]);

  const add = () => {
    const first = targets[0];
    if (!first) return;
    const op = (OPS_BY_TYPE[first.type] ?? OPS_BY_TYPE.string)[0];
    onChange([...filters, { ...first.filter, op, value: EMPTY_VALUE[valueKind(first.type, op)] } as ReportFilter]);
  };

  const replace = (index: number, next: ReportFilter) => onChange(filters.map((f, i) => (i === index ? next : f)));

  return (
    <div data-slot="filter-builder" className="space-y-2">
      {filters.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      <ul className="space-y-2">
        {filters.map((f, i) => (
          <FilterRow
            key={`${targetKey(f)}-${i}`}
            filter={f}
            target={byKey.get(targetKey(f))}
            targets={targets}
            error={errors[i]}
            disabled={disabled}
            onChange={(next) => replace(i, next)}
            onRemove={() => onChange(filters.filter((_, k) => k !== i))}
          />
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        disabled={disabled || targets.length === 0}
        onClick={add}
      >
        <Plus className="me-1.5 h-3.5 w-3.5" />
        {t("add")}
      </Button>
    </div>
  );
}

interface FilterRowProps {
  filter: ReportFilter;
  target: Target | undefined;
  targets: Target[];
  error?: string;
  disabled?: boolean;
  onChange: (next: ReportFilter) => void;
  onRemove: () => void;
}

function FilterRow({ filter, target, targets, error, disabled, onChange, onRemove }: FilterRowProps) {
  const t = useTranslations("reportBuilder.filters");
  const to = useTranslations("reportBuilder.ops");
  const tc = useTranslations("reportBuilder.common");
  const type = target?.type ?? "string";
  const ops = OPS_BY_TYPE[type] ?? OPS_BY_TYPE.string;
  const kind = valueKind(type, filter.op);

  const pickTarget = (key: string) => {
    const next = targets.find((x) => x.value === key);
    if (!next) return;
    const nextOps = OPS_BY_TYPE[next.type] ?? OPS_BY_TYPE.string;
    const op = nextOps.includes(filter.op) ? filter.op : nextOps[0];
    onChange({ ...next.filter, op, value: EMPTY_VALUE[valueKind(next.type, op)] } as ReportFilter);
  };

  const pickOp = (op: FilterOp) => {
    const nextKind = valueKind(type, op);
    onChange({ ...filter, op, value: nextKind === kind ? filter.value : EMPTY_VALUE[nextKind] });
  };

  const setValue = (value: ReportFilter["value"]) => onChange({ ...filter, value });

  return (
    <li className="rounded-lg border bg-card p-2.5">
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
          <SearchableSelect<string>
            options={targets.map((x) => ({ value: x.value, label: x.label, hint: x.hint }))}
            value={target ? target.value : ""}
            onChange={pickTarget}
            disabled={disabled}
            placeholder={t("column")}
            searchPlaceholder={tc("search")}
            emptyText={tc("noResults")}
          />
          <SearchableSelect<string>
            options={ops.map((op) => ({ value: op, label: to(op) }))}
            value={filter.op}
            onChange={(v) => pickOp(v as FilterOp)}
            disabled={disabled}
            placeholder={t("op")}
            searchPlaceholder={tc("search")}
            emptyText={tc("noResults")}
          />
          {kind !== "none" && (
            <div className="sm:col-span-2">
              <ValueEditor kind={kind} value={filter.value} options={target?.options ?? []} onChange={setValue} disabled={disabled} />
            </div>
          )}
          {error && <p className="text-[11px] text-destructive sm:col-span-2">{error}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          disabled={disabled}
          onClick={onRemove}
          aria-label={t("remove")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

const asPair = (v: ReportFilter["value"]): [string, string] => {
  const arr = Array.isArray(v) ? v : [];
  return [String(arr[0] ?? ""), String(arr[1] ?? "")];
};

const asList = (v: ReportFilter["value"]): (string | number)[] => (Array.isArray(v) ? v : []);

const numberOrText = (raw: string): string | number => {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) ? n : raw;
};

const splitList = (raw: string) =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

interface ValueEditorProps {
  kind: ValueKind;
  value: ReportFilter["value"];
  options: CatalogOption[];
  onChange: (value: ReportFilter["value"]) => void;
  disabled?: boolean;
}

function ValueEditor({ kind, value, options, onChange, disabled }: ValueEditorProps) {
  const t = useTranslations("reportBuilder.filters");
  const tc = useTranslations("reportBuilder.common");
  const [from, to] = asPair(value);

  const editors: Record<ValueKind, () => ReactNode> = {
    none: () => null,
    enum: () => (
      <SearchableSelect<string>
        options={options.map((o) => ({ value: o.value, label: o.label }))}
        value={typeof value === "string" ? value : ""}
        onChange={(v) => onChange(v)}
        disabled={disabled}
        placeholder={t("pickValue")}
        searchPlaceholder={tc("search")}
        emptyText={tc("noResults")}
      />
    ),
    enumMulti: () => (
      <MultiSelect<string>
        options={options.map((o) => ({ value: o.value, label: o.label }))}
        selected={asList(value).map(String)}
        onChange={(vals) => onChange(vals)}
        disabled={disabled}
        placeholder={t("pickValues")}
        searchPlaceholder={tc("search")}
        emptyText={tc("noResults")}
        className="w-full"
      />
    ),
    boolean: () => (
      <SearchableSelect<string>
        options={[
          { value: "true", label: t("true") },
          { value: "false", label: t("false") },
        ]}
        value={value === false ? "false" : "true"}
        onChange={(v) => onChange(v === "true")}
        disabled={disabled}
        searchPlaceholder={tc("search")}
        emptyText={tc("noResults")}
      />
    ),
    date: () => (
      <DatePicker value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v)} disabled={disabled} placeholder={t("date")} />
    ),
    dateRange: () => (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <DatePicker value={from} onChange={(v) => onChange([v, to])} disabled={disabled} placeholder={t("from")} />
        <DatePicker value={to} onChange={(v) => onChange([from, v])} disabled={disabled} placeholder={t("to")} />
      </div>
    ),
    number: () => (
      <Input
        type="number"
        inputMode="decimal"
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => onChange(numberOrText(e.target.value))}
        disabled={disabled}
        placeholder={t("value")}
        className="h-9"
      />
    ),
    numberRange: () => (
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          inputMode="decimal"
          value={from}
          onChange={(e) => onChange([numberOrText(e.target.value), numberOrText(to)])}
          disabled={disabled}
          placeholder={t("from")}
          className="h-9"
        />
        <Input
          type="number"
          inputMode="decimal"
          value={to}
          onChange={(e) => onChange([numberOrText(from), numberOrText(e.target.value)])}
          disabled={disabled}
          placeholder={t("to")}
          className="h-9"
        />
      </div>
    ),
    numberList: () => (
      <Input
        defaultValue={asList(value).join(", ")}
        onBlur={(e) => onChange(splitList(e.target.value).map(numberOrText))}
        disabled={disabled}
        placeholder={t("valuesPlaceholder")}
        className="h-9"
      />
    ),
    textList: () => (
      <Input
        defaultValue={asList(value).join(", ")}
        onBlur={(e) => onChange(splitList(e.target.value))}
        disabled={disabled}
        placeholder={t("valuesPlaceholder")}
        className="h-9"
      />
    ),
    text: () => (
      <Input
        value={typeof value === "string" ? value : String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={t("value")}
        className="h-9"
      />
    ),
  };

  return <>{editors[kind]()}</>;
}

/** Filters whose value is still blank — they are left out of the definition sent to Data. */
export function isFilterComplete(f: ReportFilter): boolean {
  if (NULL_OPS.has(f.op)) return true;
  if (f.op === "between") return asPair(f.value).every((v) => v !== "");
  if (LIST_OPS.has(f.op)) return asList(f.value).length > 0;
  return f.value !== "" && f.value !== null && f.value !== undefined;
}
