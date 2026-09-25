"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  checkCellInput,
  datePart,
  formatDateOnly,
  isBlank,
  toBool,
  toEditorValue,
} from "@/lib/workbooks/cells";
import type { CellValue, WorkbookColumn } from "@/types/workbooks.types";

const EMPTY = "__empty__";

interface GridCellProps {
  column: WorkbookColumn;
  value: CellValue;
  editable: boolean;
  saving: boolean;
  error: string | null;
  /** select: the allowed values a type-mismatch reported, when newer than `column.options`. */
  allowed?: string[];
  /** raw editor string → resolves true when saved. Throws on failure (the store keeps the error). */
  onSave: (raw: string) => Promise<boolean>;
  onClearError: () => void;
}

/** Read-only rendering of one value, typed. */
export function CellDisplay({ column, value }: { column: WorkbookColumn; value: CellValue }) {
  const t = useTranslations("workbooks");
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  if (isBlank(value)) return <span className="text-muted-foreground/50">—</span>;

  switch (column.type) {
    case "boolean": {
      const b = toBool(value);
      if (b === null) return <span className="text-muted-foreground/50">—</span>;
      return (
        <span
          className={cn(
            "inline-flex rounded-full border px-1.5 py-0.5 text-[11px] font-medium",
            b
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          {b ? t("common.yes") : t("common.no")}
        </span>
      );
    }
    case "date": {
      const d = datePart(value);
      return <span className="tabular-nums">{d ? formatDateOnly(d, locale) : String(value)}</span>;
    }
    case "number":
      return <span className="tabular-nums">{String(value)}</span>;
    case "select":
      return (
        <span className="inline-block max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-xs">
          {String(value)}
        </span>
      );
    case "long_text":
      return <span className="line-clamp-2 whitespace-pre-line break-words">{String(value)}</span>;
    default:
      return <span className="line-clamp-2 break-words">{String(value)}</span>;
  }
}

/**
 * One grid cell. Text-like types are click-to-edit (Enter / blur saves,
 * Escape cancels); date, select and boolean are live controls that save on
 * change. Every save is a single-key partial update.
 */
export function GridCell({ column, value, editable, saving, error, allowed, onSave, onClearError }: GridCellProps) {
  const t = useTranslations("workbooks");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const current = toEditorValue(column, value);
  const shownError = localError ?? error;

  const commit = async (raw: string) => {
    const problem = checkCellInput({ ...column, options: allowed ?? column.options }, raw);
    if (problem) {
      setLocalError(t(`cell.${problem}`));
      return;
    }
    setLocalError(null);
    if (raw.trim() === current.trim()) {
      setEditing(false);
      return;
    }
    try {
      await onSave(raw);
      setEditing(false);
    } catch {
      // The store holds the message; stay in edit mode so the value isn't lost.
    }
  };

  const startEditing = () => {
    if (!editable) return;
    onClearError();
    setLocalError(null);
    setDraft(current);
    setEditing(true);
  };

  const status = (
    <>
      {saving && <Loader2 className="absolute end-1 top-1 h-3 w-3 animate-spin text-muted-foreground" />}
      {shownError && !saving && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertCircle className="absolute end-1 top-1 h-3.5 w-3.5 text-destructive" aria-label={shownError} />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{shownError}</TooltipContent>
        </Tooltip>
      )}
    </>
  );

  const wrapper = cn(
    "relative min-h-9 rounded-md transition-colors",
    shownError && "ring-1 ring-destructive/60 bg-destructive/5",
  );

  if (!editable) {
    return (
      <div className={cn(wrapper, "px-2 py-1.5 text-sm")}>
        <CellDisplay column={column} value={value} />
        {status}
      </div>
    );
  }

  /* ── Live controls ─────────────────────────────────────────────────── */

  if (column.type === "boolean") {
    const b = toBool(value);
    return (
      <div className={cn(wrapper, "flex items-center px-2 py-1.5")}>
        <Checkbox
          checked={b === true}
          disabled={saving}
          onCheckedChange={(v) => void commit(v === true ? "true" : "false")}
          aria-label={column.name}
        />
        {status}
      </div>
    );
  }

  if (column.type === "select") {
    const opts = allowed ?? column.options ?? [];
    const options = [
      ...(column.required ? [] : [{ value: EMPTY, label: t("cell.empty") }]),
      ...opts.map((o) => ({ value: o, label: o })),
    ];
    return (
      <div className={cn(wrapper, "py-0.5")}>
        <SearchableSelect<string>
          options={options}
          value={current === "" ? (column.required ? "" : EMPTY) : current}
          onChange={(v) => void commit(v === EMPTY ? "" : v)}
          disabled={saving}
          placeholder={t("cell.pick")}
          searchPlaceholder={t("common.search")}
          emptyText={t("common.noResults")}
          className="h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input"
        />
        {status}
      </div>
    );
  }

  if (column.type === "date") {
    return (
      <div className={cn(wrapper, "py-0.5")}>
        <DatePicker
          value={datePart(value)}
          onChange={(v) => void commit(v)}
          disabled={saving}
          className="h-8 min-w-[150px] [&_input]:h-8 [&_input]:border-transparent [&_input]:bg-transparent [&_input]:shadow-none [&_input:hover]:border-input [&_button]:h-8"
        />
        {status}
      </div>
    );
  }

  if (column.type === "long_text") {
    return (
      <Popover
        open={editing}
        onOpenChange={(o) => {
          if (o) startEditing();
          else setEditing(false);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(wrapper, "block w-full px-2 py-1.5 text-start text-sm hover:bg-muted/60")}
            title={t("grid.edit")}
          >
            <CellDisplay column={column} value={value} />
            {status}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-2 p-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void commit(draft);
              }
            }}
            className="h-40 resize-none text-sm"
            autoFocus
            aria-label={column.name}
          />
          {shownError && <p className="text-[11px] text-destructive">{shownError}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">{t("cell.ctrlEnter")}</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={() => void commit(draft)} disabled={saving}>
                {saving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
                {t("common.save")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  /* ── text / number: click to edit ─────────────────────────────────── */

  if (editing) {
    return (
      <div className={cn(wrapper, "py-0.5")}>
        <Input
          ref={inputRef}
          value={draft}
          inputMode={column.type === "number" ? "decimal" : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setLocalError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit(draft);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setLocalError(null);
              onClearError();
              setEditing(false);
            }
          }}
          onBlur={() => void commit(draft)}
          disabled={saving}
          aria-label={column.name}
          aria-invalid={Boolean(shownError) || undefined}
          className={cn("h-8 px-2 text-sm", column.type === "number" && "tabular-nums")}
        />
        {status}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={cn(wrapper, "block w-full px-2 py-1.5 text-start text-sm hover:bg-muted/60")}
      title={t("grid.edit")}
    >
      <CellDisplay column={column} value={value} />
      {status}
    </button>
  );
}
