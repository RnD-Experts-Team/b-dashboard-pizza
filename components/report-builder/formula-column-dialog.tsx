"use client";

import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, FunctionSquare, XCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { MAX_LABEL_LENGTH, type FormulaColumn, type FormulaType } from "@/lib/report-builder/definition";
import { formatCell } from "@/lib/report-builder/format";
import {
  FORMULA_FUNCTIONS,
  evaluateFormulas,
  validateFormulas,
  type FormulaError,
  type FormulaValue,
} from "@/lib/report-builder/formula";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Add / edit one formula column. The expression is checked on every key     */
/*  with the same parser Data uses (syntax, unknown ids, cycles through other */
/*  formulas) and evaluated against the first preview row as a sample.        */
/* ────────────────────────────────────────────────────────────────────────── */

/** "Show as" choices → the column's `type` + optional `format`. */
const DISPLAY: Record<string, { type: FormulaType; format?: "percent" }> = {
  number: { type: "number" },
  integer: { type: "integer" },
  money: { type: "money" },
  percent: { type: "number", format: "percent" },
  string: { type: "string" },
  boolean: { type: "boolean" },
};
const DISPLAY_KEYS = Object.keys(DISPLAY);

function displayOf(c: Pick<FormulaColumn, "type" | "format"> | null): string {
  if (!c) return "number";
  if (c.format === "percent") return "percent";
  return c.type;
}

const formSchema = z.object({
  label: z.string().trim().min(1).max(MAX_LABEL_LENGTH),
  expr: z.string(),
  display: z.enum(DISPLAY_KEYS as [string, ...string[]]),
});
type FormValues = z.infer<typeof formSchema>;

interface FormulaReference {
  id: string;
  label: string;
}

interface FormulaColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The column being edited, or null to add one with `newId`. */
  initial: FormulaColumn | null;
  newId: string;
  /** Every OTHER report column (dataset and formula), for the chips and the id check. */
  references: FormulaReference[];
  /** Every OTHER formula column, for the cycle check and the sample. */
  otherFormulas: Pick<FormulaColumn, "id" | "expr">[];
  /** First preview row keyed by column id, when a preview exists. */
  sampleRow: Record<string, unknown> | null;
  onSave: (column: FormulaColumn) => void;
}

export function FormulaColumnDialog({
  open,
  onOpenChange,
  initial,
  newId,
  references,
  otherFormulas,
  sampleRow,
  onSave,
}: FormulaColumnDialogProps) {
  const t = useTranslations("reportBuilder.formula");
  const tv = useTranslations("reportBuilder.validation");
  const tt = useTranslations("reportBuilder.formulaTypes");
  const tc = useTranslations("reportBuilder.common");
  const tcell = useTranslations("reportBuilder.cell");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const exprRef = useRef<HTMLTextAreaElement | null>(null);
  const id = initial?.id ?? newId;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { label: "", expr: "", display: "number" },
  });
  const { register, handleSubmit, reset, setValue, formState, control } = form;

  useEffect(() => {
    if (open) reset({ label: initial?.label ?? "", expr: initial?.expr ?? "", display: displayOf(initial) });
  }, [open, initial, reset]);

  const expr = useWatch({ control, name: "expr" }) ?? "";
  const display = useWatch({ control, name: "display" }) ?? "number";
  const exprField = register("expr");

  const knownIds = useMemo(() => [...references.map((r) => r.id), id], [references, id]);
  const all = useMemo(() => [...otherFormulas, { id, expr }], [otherFormulas, id, expr]);
  const error: FormulaError | undefined = useMemo(() => validateFormulas(all, knownIds).errors[id], [all, knownIds, id]);

  const sample: FormulaValue | undefined = useMemo(() => {
    if (error || !sampleRow) return undefined;
    return evaluateFormulas(all, sampleRow, knownIds)[id];
  }, [error, sampleRow, all, knownIds, id]);

  const errorText = (e: FormulaError) => {
    const key = `formula.${e.code}`;
    const message = tv.has(key) ? tv(key, e.params ?? {}) : e.message;
    return t("errorAt", { position: e.position + 1, message });
  };

  /** Inserts text at the caret (or over the selection) and keeps focus. */
  const insert = (text: string) => {
    const el = exprRef.current;
    const start = el?.selectionStart ?? expr.length;
    const end = el?.selectionEnd ?? expr.length;
    const next = `${expr.slice(0, start)}${text}${expr.slice(end)}`;
    setValue("expr", next, { shouldDirty: true });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const submit = handleSubmit((values) => {
    if (error) return;
    const shape = DISPLAY[values.display] ?? DISPLAY.number;
    onSave({ id, kind: "formula", label: values.label.trim(), expr: values.expr.trim(), ...shape });
    onOpenChange(false);
  });

  const sampleText = () => {
    if (sample === null) return t("sampleNull");
    const shape = DISPLAY[display] ?? DISPLAY.number;
    return formatCell(sample, shape, locale, { yes: tcell("yes"), no: tcell("no") }) || t("sampleNull");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading font-semibold">
            <FunctionSquare className="h-4 w-4 text-primary" />
            {initial ? t("titleEdit") : t("titleNew")}
            <span className="rounded bg-muted px-1.5 font-mono text-xs font-normal text-muted-foreground">{id}</span>
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form id="formula-column-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-1.5">
              <Label htmlFor="formula-label">{t("label")}</Label>
              <Input
                id="formula-label"
                {...register("label")}
                placeholder={t("labelPlaceholder")}
                maxLength={MAX_LABEL_LENGTH}
                aria-invalid={Boolean(formState.errors.label) || undefined}
              />
              {formState.errors.label && <p className="text-[11px] text-destructive">{t("labelRequired")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{t("displayAs")}</Label>
              <SearchableSelect<string>
                options={DISPLAY_KEYS.map((k) => ({ value: k, label: tt(k) }))}
                value={display}
                onChange={(v) => setValue("display", v, { shouldDirty: true })}
                searchPlaceholder={tc("search")}
                emptyText={tc("noResults")}
                contentClassName="z-[60]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="formula-expr">{t("expression")}</Label>
            <Textarea
              id="formula-expr"
              dir="ltr"
              rows={3}
              spellCheck={false}
              placeholder={t("expressionPlaceholder")}
              className="font-mono text-sm"
              aria-invalid={Boolean(error && expr) || undefined}
              {...exprField}
              ref={(el) => {
                exprField.ref(el);
                exprRef.current = el;
              }}
            />
            <p className="text-[11px] text-muted-foreground">{t("hint")}</p>
            {expr.trim() !== "" && error && (
              <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-2" role="alert">
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {errorText(error)}
                </p>
                <pre dir="ltr" className="overflow-x-auto font-mono text-[11px] leading-tight text-muted-foreground">
                  {expr}
                  {"\n"}
                  {" ".repeat(Math.max(0, error.position))}^
                </pre>
              </div>
            )}
            {expr.trim() !== "" && !error && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("ok")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">{t("insert")}</p>
            {references.length === 0 && <p className="text-[11px] text-muted-foreground">{t("noReferences")}</p>}
            <div className="flex flex-wrap gap-1.5">
              {references.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => insert(r.id)}
                  className="inline-flex max-w-[220px] items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs transition-colors hover:bg-accent"
                  title={r.label}
                >
                  <span className="font-mono font-semibold text-primary">{r.id}</span>
                  <span className="truncate text-muted-foreground">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">{t("functions")}</p>
            <div className="flex flex-wrap gap-1.5" dir="ltr">
              {FORMULA_FUNCTIONS.map((fn) => (
                <button
                  key={fn}
                  type="button"
                  onClick={() => insert(`${fn}(`)}
                  className="rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:bg-accent"
                >
                  {fn}()
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("sample")}</p>
            <p className="mt-0.5 font-mono text-sm tabular-nums">
              {sampleRow === null && <span className="font-sans text-xs text-muted-foreground">{t("sampleEmpty")}</span>}
              {sampleRow !== null && sample === undefined && <span className="text-muted-foreground">—</span>}
              {sampleRow !== null && sample !== undefined && sampleText()}
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="formula-column-form" disabled={Boolean(error)}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
