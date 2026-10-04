"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect, type SearchableSelectOption } from "@/components/shared/searchable-select";
import { DialogShell, Field, FormError } from "@/components/workbooks/dialog-shell";
import { formErrors, parseTicketError } from "@/lib/toolbox-tickets/errors";
import { isValidKey, suggestKey } from "@/lib/toolbox-tickets/sections";

export interface CatalogFormValues {
  key: string;
  name: string;
  description: string;
  displayOrder: string;
  /** Levels only. `""` = top level. */
  parentId: string;
}

interface CatalogFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "section" | "level";
  /** null = create. On edit the key is shown read-only — it's immutable upstream. */
  initial: (CatalogFormValues & { id: number }) | null;
  /** Create only — prefilled values, e.g. the parent for "add child". */
  defaults?: Partial<CatalogFormValues>;
  /**
   * Create only — the prefilled key is fixed (Coverage: it's the key the
   * "Report a problem" button already sends, so it can't be reworded).
   */
  lockKey?: boolean;
  /** Levels only — already excludes self + descendants (cycle prevention). */
  parentOptions?: SearchableSelectOption<string>[];
  /** Levels only — id → name, to spell out a TICKET_LEVEL_CYCLE `error.path`. */
  levelNames?: Map<number, string>;
  onSubmit: (values: CatalogFormValues) => Promise<unknown>;
  onError: (err: unknown) => void;
}

const EMPTY: CatalogFormValues = { key: "", name: "", description: "", displayOrder: "", parentId: "" };

/** Create/edit form shared by sections and levels (same key rules, same fields). */
export function CatalogFormDialog({
  open,
  onOpenChange,
  kind,
  initial,
  defaults,
  lockKey,
  parentOptions,
  levelNames,
  onSubmit,
  onError,
}: CatalogFormDialogProps) {
  const t = useTranslations("toolboxTickets.admin.form");
  const tc = useTranslations("toolboxTickets.common");
  const [values, setValues] = useState<CatalogFormValues>(EMPTY);
  const [keyTouched, setKeyTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = initial !== null;

  useEffect(() => {
    if (!open) return;
    setValues(initial ?? { ...EMPTY, ...defaults });
    setKeyTouched(false);
    setErrors({});
    setFormError(null);
    // Keyed on the record id, not the object: panels rebuild `initial` every
    // render, and a re-render (e.g. the refresh after a save) must not wipe
    // what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const set = (patch: Partial<CatalogFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const submit = async () => {
    if (saving) return;
    const e: Record<string, string> = {};
    if (!editing) {
      if (!values.key) e.key = t("errors.keyRequired");
      else if (!isValidKey(values.key)) e.key = t("errors.keyFormat");
    }
    if (!values.name.trim()) e.name = t("errors.nameRequired");
    if (values.displayOrder && !/^\d{1,6}$/.test(values.displayOrder)) e.display_order = t("errors.order");
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    setFormError(null);
    try {
      await onSubmit({ ...values, name: values.name.trim(), description: values.description.trim() });
      onOpenChange(false);
    } catch (err) {
      const parsed = parseTicketError(err, "admin");
      const fe = formErrors(parsed);
      if (parsed.code === "TICKET_LEVEL_CYCLE" && parsed.path?.length) {
        // `path` may hold ids or level objects — print names either way.
        const label = (p: unknown): string => {
          if (p && typeof p === "object") {
            const o = p as { name?: unknown; key?: unknown; id?: unknown };
            return String(o.name ?? o.key ?? (o.id != null ? `#${o.id}` : "?"));
          }
          const id = Number(p);
          return (Number.isFinite(id) && levelNames?.get(id)) || String(p);
        };
        fe.parent_id = t("errors.cycle", { path: parsed.path.map(label).join(" → ") });
      }
      // A fixed key can't be corrected in its read-only field — say it up top.
      let lockedKeyError: string | null = null;
      if (lockKey && fe.key) {
        lockedKeyError = fe.key;
        delete fe.key;
      }
      setErrors(fe);
      if (lockedKeyError) {
        setFormError(lockedKeyError);
        onError(parsed);
      } else if (!["key", "name", "description", "display_order", "parent_id"].some((k) => fe[k])) {
        setFormError(parsed.message);
        onError(parsed);
      }
    } finally {
      setSaving(false);
    }
  };

  const noun = kind === "section" ? t("section") : t("level");

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogShell
        busy={saving}
        title={editing ? t("editTitle", { noun }) : t("createTitle", { noun })}
        description={kind === "section" ? t("sectionDescription") : t("levelDescription")}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {saving ? tc("saving") : tc("save")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError message={formError} />
          <Field label={t("name")} htmlFor="tbx-cat-name" required error={errors.name}>
            <Input
              id="tbx-cat-name"
              value={values.name}
              maxLength={190}
              onChange={(e) => {
                const name = e.target.value;
                set(!editing && !lockKey && !keyTouched ? { name, key: suggestKey(name) } : { name });
              }}
              placeholder={kind === "section" ? t("namePlaceholderSection") : t("namePlaceholderLevel")}
              disabled={saving}
            />
          </Field>
          <Field
            label={t("key")}
            htmlFor="tbx-cat-key"
            required={!editing}
            error={errors.key}
            hint={editing ? t("keyLocked") : lockKey ? t("keyFixed") : t("keyHint")}
          >
            <Input
              id="tbx-cat-key"
              value={values.key}
              maxLength={64}
              readOnly={editing || lockKey}
              onChange={(e) => {
                setKeyTouched(true);
                set({ key: e.target.value.toLowerCase() });
              }}
              placeholder={kind === "section" ? "area.page" : "operations"}
              disabled={saving}
              className="font-mono text-xs read-only:bg-muted read-only:text-muted-foreground"
              dir="ltr"
            />
          </Field>
          {kind === "level" && parentOptions && (
            <Field label={t("parent")} error={errors.parent_id} hint={t("parentHint")}>
              <SearchableSelect<string>
                options={[{ value: "", label: t("topLevel") }, ...parentOptions]}
                value={values.parentId}
                onChange={(parentId) => set({ parentId })}
                searchPlaceholder={tc("search")}
                emptyText={tc("noMatches")}
                disabled={saving}
              />
            </Field>
          )}
          <Field label={t("descriptionLabel")} htmlFor="tbx-cat-desc" error={errors.description}>
            <Textarea
              id="tbx-cat-desc"
              value={values.description}
              maxLength={2000}
              onChange={(e) => set({ description: e.target.value })}
              disabled={saving}
              className="min-h-20 resize-y"
            />
          </Field>
          <Field label={t("order")} htmlFor="tbx-cat-order" error={errors.display_order} hint={t("orderHint")}>
            <Input
              id="tbx-cat-order"
              inputMode="numeric"
              value={values.displayOrder}
              onChange={(e) => set({ displayOrder: e.target.value.replace(/\D/g, "") })}
              disabled={saving}
              className="w-32 tabular-nums"
            />
          </Field>
        </div>
      </DialogShell>
    </Dialog>
  );
}
