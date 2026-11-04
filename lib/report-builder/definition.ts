import { z } from "zod";
import type { CatalogDatasetRef, GrainKey } from "@/types/report-builder.types";
import { validateFormulas, type FormulaError } from "./formula";
import { PERIOD_TOKENS, signedDaysBetween } from "./periods";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Report definition JSON v1 — the zod mirror of Data's                      */
/*  ReportDefinitionValidator (stored in report_templates.definition).        */
/*                                                                            */
/*  `definitionSchema` checks the SHAPE; `definitionIssues()` adds the rules  */
/*  that need the whole definition (ids, aliases, formulas, cycles) and, when */
/*  the catalog is known, the dataset rules (grain keys, aggregations).       */
/*  Issue `code`s are i18n keys under `reportBuilder.validation`. The server  */
/*  re-validates everything.                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const DEFINITION_VERSION = 1;
export const MAX_LABEL_LENGTH = 120;
/** The row ceiling older templates were saved with; read back as "no limit". */
const LEGACY_ROW_CEILING = 100_000;

export const GRAIN_KEYS = ["store", "date", "employee"] as const satisfies readonly GrainKey[];
const AGGREGATIONS = ["count", "count_distinct", "sum", "avg", "min", "max"] as const;
const FILTER_OPS = [
  "eq",
  "neq",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "contains",
  "is_null",
  "not_null",
] as const;
const FORMULA_TYPES = ["number", "integer", "money", "string", "boolean"] as const;
const FORMULA_FORMATS = ["percent"] as const;

export type FilterOp = (typeof FILTER_OPS)[number];
export type StoreMode = "all" | "mine" | "list";

// Report column id: "c1", "c12"; rejects "1c", "c-1", "".
// Tester: https://regex101.com/?flavor=javascript&regex=%5Ec%5B1-9%5D%5Cd*%24&testString=c12
const COLUMN_ID_RE = /^c[1-9]\d*$/;
// Dataset alias: one lowercase letter then letters/digits/underscores (up to 16 in all), e.g. "s", "l2", "sales_a"; rejects "S", "2a".
// Tester: https://regex101.com/?flavor=javascript&regex=%5E%5Ba-z%5D%5Ba-z0-9_%5D%7B0%2C15%7D%24&testString=sales_a
const ALIAS_RE = /^[a-z][a-z0-9_]{0,15}$/;
// Store code "03795-00001": five digits, a dash, five digits; rejects "3795-1" and "03795".
// Tester: https://regex101.com/?flavor=javascript&regex=%5E%5Cd%7B5%7D-%5Cd%7B5%7D%24&testString=03795-00001
const STORE_CODE_RE = /^\d{5}-\d{5}$/;
// Calendar date "2026-10-21"; rejects "2026-1-2" and "10/21/2026".
// Tester: https://regex101.com/?flavor=javascript&regex=%5E%5Cd%7B4%7D-%5Cd%7B2%7D-%5Cd%7B2%7D%24&testString=2026-10-21
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const columnId = z.string().regex(COLUMN_ID_RE);
const alias = z.string().regex(ALIAS_RE);
const label = z.string().trim().min(1).max(MAX_LABEL_LENGTH);

/** "2026-02-30" has the right shape but is no day: parse it and compare it back. */
function isRealDate(iso: string): boolean {
  const parsed = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso;
}

const isoDate = z.string().regex(DATE_RE).refine(isRealDate);

const datasetRefSchema = z.object({ alias, key: z.string().min(1) });

const datasetColumnSchema = z.object({
  id: columnId,
  kind: z.literal("dataset").optional(),
  alias,
  column: z.string().min(1),
  /** null = a grain (group) column; otherwise one of the column's own aggregations. */
  agg: z.enum(AGGREGATIONS).nullable().optional(),
  label,
});

const formulaColumnSchema = z.object({
  id: columnId,
  kind: z.literal("formula"),
  expr: z.string().min(1),
  label,
  type: z.enum(FORMULA_TYPES),
  format: z.enum(FORMULA_FORMATS).optional(),
});

const columnSchema = z.union([formulaColumnSchema, datasetColumnSchema]);

const scalar = z.union([z.string(), z.number(), z.boolean()]);
const filterValue = z.union([scalar, z.array(z.union([z.string(), z.number()]))]).nullable().optional();

const BETWEEN_VALUES = 2;

/** Whether `value` has the shape `op` needs: a pair, a list, nothing, or one scalar. */
function valueFitsOp(op: FilterOp, value: z.infer<typeof filterValue>): boolean {
  if (op === "between") return Array.isArray(value) && value.length === BETWEEN_VALUES;
  if (op === "in" || op === "not_in") return Array.isArray(value) && value.length > 0;
  if (op === "is_null" || op === "not_null") return value === null || value === undefined;
  return value !== null && value !== undefined && !Array.isArray(value);
}

const fitsOp = { message: "value does not fit op", path: ["value"] };

/** A filter on a dataset column (pushed down to the service) … */
const datasetFilterSchema = z
  .object({ alias, column: z.string().min(1), op: z.enum(FILTER_OPS), value: filterValue })
  .refine((f) => valueFitsOp(f.op, f.value), fitsOp);
/** … or on a formula column (applied by Data after the merge). */
const formulaFilterSchema = z
  .object({ id: columnId, op: z.enum(FILTER_OPS), value: filterValue })
  .refine((f) => valueFitsOp(f.op, f.value), fitsOp);
const filterSchema = z.union([datasetFilterSchema, formulaFilterSchema]);

const sortSchema = z.object({ id: columnId, dir: z.enum(["asc", "desc"]) });

const periodSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("relative"), token: z.enum(PERIOD_TOKENS) }),
  z.object({ type: z.literal("fixed"), from: isoDate, to: isoDate }),
]);

const storesSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({ mode: z.literal("mine") }),
  z.object({ mode: z.literal("list"), codes: z.array(z.string().regex(STORE_CODE_RE)).min(1) }),
]);

const definitionSchema = z.object({
  v: z.literal(DEFINITION_VERSION),
  datasets: z.array(datasetRefSchema).min(1),
  /** May be empty: a single dataset is then listed by its breakdown columns, several give one totals row. */
  grain: z.array(z.enum(GRAIN_KEYS)),
  columns: z.array(columnSchema).min(1),
  filters: z.array(filterSchema),
  sort: z.array(sortSchema),
  period: periodSchema,
  stores: storesSchema,
  /** Optional: leave it out and the run returns every row. */
  limit: z.number().int().min(1).optional(),
});

export type ReportDefinition = z.infer<typeof definitionSchema>;
export type DatasetRef = z.infer<typeof datasetRefSchema>;
export type DatasetColumn = z.infer<typeof datasetColumnSchema>;
export type FormulaColumn = z.infer<typeof formulaColumnSchema>;
export type ReportColumn = z.infer<typeof columnSchema>;
export type ReportFilter = z.infer<typeof filterSchema>;
type FormulaFilter = z.infer<typeof formulaFilterSchema>;
export type ReportPeriod = z.infer<typeof periodSchema>;
export type StoreScope = z.infer<typeof storesSchema>;
export type FormulaType = (typeof FORMULA_TYPES)[number];

export const isFormulaColumn = (c: ReportColumn): c is FormulaColumn => c.kind === "formula";
export const isDatasetColumn = (c: ReportColumn): c is DatasetColumn => c.kind !== "formula";
export const isFormulaFilter = (f: ReportFilter): f is FormulaFilter => "id" in f;

/** A brand-new, empty report: last week, the caller's own stores, store × date (narrowed to what the first dataset offers). */
export function emptyDefinition(): ReportDefinition {
  return {
    v: DEFINITION_VERSION,
    datasets: [],
    grain: ["store", "date"],
    columns: [],
    filters: [],
    sort: [],
    period: { type: "relative", token: "last_week" },
    stores: { mode: "mine" },
  };
}

/** The number in a column id: "c12" → 12. */
const columnIdNumber = (id: string): number => Number(id.slice(1));

/** The highest column id number in the definition (0 when it has no columns). */
export function highestColumnId(def: ReportDefinition): number {
  return Math.max(0, ...def.columns.map((c) => columnIdNumber(c.id)).filter(Number.isFinite));
}

/**
 * Next column id: "c1", "c2", … always above the highest id in the definition
 * AND above `floor`, the highest the editor has ever handed out, so the id of
 * a deleted column is never reused (a saved sort or filter may still name it).
 */
export function nextColumnId(def: ReportDefinition, floor = 0): string {
  return `c${Math.max(floor, highestColumnId(def)) + 1}`;
}

const ALIAS_LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

/** Next free dataset alias: "a", "b", … */
export function nextAlias(def: ReportDefinition): string {
  const used = new Set(def.datasets.map((d) => d.alias));
  return ALIAS_LETTERS.find((l) => !used.has(l)) ?? `d${def.datasets.length + 1}`;
}

/* ── Whole-definition rules ─────────────────────────────────────────────── */

export interface DefinitionIssue {
  /** Dotted path into the definition, e.g. "columns.2.expr". */
  path: string;
  /** i18n key under reportBuilder.validation. */
  code: string;
  params?: Record<string, string | number>;
  /** Set for formula issues, so the dialog can point at the character. */
  formula?: FormulaError;
}

const issue = (path: string, code: string, params?: DefinitionIssue["params"]): DefinitionIssue => ({ path, code, params });

function duplicates(values: string[]): string[] {
  return values.filter((v, i) => values.indexOf(v) !== i);
}

/** Friendlier codes for the shape problems a half-built report always has. */
const EMPTY_LIST_CODES: Record<string, string> = {
  datasets: "noDatasets",
  columns: "noColumns",
  "stores.codes": "noStores",
};

function shapeIssues(def: ReportDefinition): DefinitionIssue[] {
  const parsed = definitionSchema.safeParse(def);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => {
    const path = i.path.join(".");
    const friendly = i.code === "too_small" ? EMPTY_LIST_CODES[path] : undefined;
    return friendly ? issue(path, friendly) : issue(path, "shape", { field: path });
  });
}

function referenceIssues(def: ReportDefinition): DefinitionIssue[] {
  const aliases = new Set(def.datasets.map((d) => d.alias));
  const ids = new Set(def.columns.map((c) => c.id));
  const formulaIds = new Set(def.columns.filter(isFormulaColumn).map((c) => c.id));
  const columnRefs = def.columns.flatMap((c, i) =>
    isDatasetColumn(c) && !aliases.has(c.alias) ? [issue(`columns.${i}.alias`, "unknownAlias", { alias: c.alias })] : [],
  );
  const filterRefs = def.filters.flatMap((f, i) => {
    if (isFormulaFilter(f)) return formulaIds.has(f.id) ? [] : [issue(`filters.${i}.id`, "unknownColumn", { id: f.id })];
    return aliases.has(f.alias) ? [] : [issue(`filters.${i}.alias`, "unknownAlias", { alias: f.alias })];
  });
  const sortRefs = def.sort.flatMap((s, i) => (ids.has(s.id) ? [] : [issue(`sort.${i}.id`, "unknownColumn", { id: s.id })]));
  return [...columnRefs, ...filterRefs, ...sortRefs];
}

function uniquenessIssues(def: ReportDefinition): DefinitionIssue[] {
  const dupIds = duplicates(def.columns.map((c) => c.id)).map((id) => issue("columns", "duplicateId", { id }));
  const dupAliases = duplicates(def.datasets.map((d) => d.alias)).map((a) => issue("datasets", "duplicateAlias", { alias: a }));
  return [...dupIds, ...dupAliases];
}

function periodIssues(def: ReportDefinition): DefinitionIssue[] {
  if (def.period.type !== "fixed") return [];
  const span = signedDaysBetween(def.period.from, def.period.to);
  return span < 0 ? [issue("period", "periodOrder")] : [];
}

function formulaIssues(def: ReportDefinition): DefinitionIssue[] {
  const formulas = def.columns.filter(isFormulaColumn);
  const { errors } = validateFormulas(
    formulas.map((f) => ({ id: f.id, expr: f.expr })),
    def.columns.map((c) => c.id),
  );
  return def.columns.flatMap((c, i) => {
    const err = errors[c.id];
    return err ? [{ path: `columns.${i}.expr`, code: `formula.${err.code}`, params: err.params, formula: err }] : [];
  });
}

/* ── Dataset rules (need the catalog) ───────────────────────────────────── */

/**
 * Breakdown rule (Data's 422 "Only one dataset can add breakdown columns"): a
 * dataset column with no aggregation that is not a grain key or a computed
 * column groups its dataset by itself. Only one dataset may do that; the
 * columns of every later one are flagged.
 */
function breakdownIssues(def: ReportDefinition, byAlias: ReadonlyMap<string, CatalogDatasetRef | undefined>): DefinitionIssue[] {
  const breakdowns = def.columns.flatMap((c, i) => {
    if (!isDatasetColumn(c) || c.agg) return [];
    const col = byAlias.get(c.alias)?.columns.find((x) => x.key === c.column);
    if (!col || col.derived || (def.grain as string[]).includes(col.key)) return [];
    return [{ index: i, alias: c.alias }];
  });
  const owner = breakdowns[0]?.alias;
  return breakdowns.filter((b) => b.alias !== owner).map((b) => issue(`columns.${b.index}.agg`, "breakdownOneDataset"));
}

function datasetIssues(def: ReportDefinition, catalog: ReadonlyMap<string, CatalogDatasetRef>): DefinitionIssue[] {
  const byAlias = new Map(def.datasets.map((d) => [d.alias, catalog.get(d.key)]));
  const unknownDatasets = def.datasets.flatMap((d, i) =>
    catalog.has(d.key) ? [] : [issue(`datasets.${i}.key`, "unknownDataset", { key: d.key })],
  );
  const grainGaps = def.datasets.flatMap((d, i) => {
    const ds = catalog.get(d.key);
    if (!ds) return [];
    return def.grain
      .filter((g) => !ds.grain.includes(g))
      .map((g) => issue(`datasets.${i}`, "grainMissing", { dataset: ds.label, grain: g }));
  });
  const columnRules = def.columns.flatMap((c, i) => {
    if (!isDatasetColumn(c)) return [];
    const ds = byAlias.get(c.alias);
    const col = ds?.columns.find((x) => x.key === c.column);
    if (!ds) return [];
    if (!col) return [issue(`columns.${i}.column`, "unknownDatasetColumn", { column: c.column, dataset: ds.label })];
    const isGrain = (def.grain as string[]).includes(col.key);
    if (!c.agg) {
      // No aggregation: a grain key, a computed column, or a breakdown column (a groupable dimension).
      if (!isGrain && !col.derived && col.groupable !== true) return [issue(`columns.${i}.agg`, "aggregationRequired", { label: c.label })];
      return [];
    }
    if (!(col.aggregations ?? []).includes(c.agg))
      return [issue(`columns.${i}.agg`, "aggregationNotAllowed", { label: c.label, agg: c.agg })];
    return [];
  });
  const breakdownRule = breakdownIssues(def, byAlias);
  const filterRules = def.filters.flatMap((f, i) => {
    if (isFormulaFilter(f)) return [];
    const col = byAlias.get(f.alias)?.columns.find((x) => x.key === f.column);
    return col && col.filterable === false ? [issue(`filters.${i}.column`, "notFilterable", { column: col.label ?? col.key })] : [];
  });
  return [...unknownDatasets, ...grainGaps, ...columnRules, ...breakdownRule, ...filterRules];
}

/**
 * Every problem with a definition, shape first. Pass the catalog (by dataset
 * key) to include the dataset rules; leave it out when it is not loaded yet.
 */
export function definitionIssues(
  def: ReportDefinition,
  catalog?: ReadonlyMap<string, CatalogDatasetRef>,
): DefinitionIssue[] {
  return [
    ...shapeIssues(def),
    ...uniquenessIssues(def),
    ...referenceIssues(def),
    ...formulaIssues(def),
    ...periodIssues(def),
    ...(catalog ? datasetIssues(def, catalog) : []),
  ];
}

/** Coerces whatever the server stored into a definition the builder can edit. */
export function readDefinition(raw: unknown): ReportDefinition {
  const base = emptyDefinition();
  if (!raw || typeof raw !== "object") return base;
  const merged = { ...base, ...(raw as Record<string, unknown>) };
  // Templates saved while rows were capped carry the old ceiling as their limit; it now means "all rows".
  if (merged.limit === LEGACY_ROW_CEILING) delete merged.limit;
  const parsed = definitionSchema.safeParse(merged);
  if (parsed.success) return parsed.data;
  // Keep what is usable; the issues list explains the rest.
  const pick = <K extends keyof ReportDefinition>(key: K, schema: z.ZodType<ReportDefinition[K]>): ReportDefinition[K] => {
    const r = schema.safeParse(merged[key]);
    return r.success ? r.data : base[key];
  };
  return {
    v: DEFINITION_VERSION,
    datasets: pick("datasets", z.array(datasetRefSchema)),
    grain: pick("grain", z.array(z.enum(GRAIN_KEYS))),
    columns: pick("columns", z.array(columnSchema)),
    filters: pick("filters", z.array(filterSchema)),
    sort: pick("sort", z.array(sortSchema)),
    period: pick("period", periodSchema),
    stores: pick("stores", storesSchema),
    limit: pick("limit", z.number().int().min(1).optional()),
  };
}
