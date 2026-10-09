"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DialogShell, FormError } from "@/components/workbooks/dialog-shell";
import { parseTicketError } from "@/lib/toolbox-tickets/errors";
import type { TicketLevel, TicketSection } from "@/types/toolbox-tickets.types";

interface LevelSectionsDialogProps {
  level: TicketLevel | null;
  sections: TicketSection[];
  /** Section ids currently under this level. */
  current: number[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (sectionIds: number[]) => Promise<unknown>;
}

/**
 * Which sections sit under a level. The endpoint is a WHOLE-LIST REPLACE:
 * what's checked when you save is the full set, and saving none detaches all.
 */
export function LevelSectionsDialog({ level, sections, current, onOpenChange, onSubmit }: LevelSectionsDialogProps) {
  const t = useTranslations("toolboxTickets.admin.levelSections");
  const tc = useTranslations("toolboxTickets.common");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!level) return;
    setSelected(new Set(current));
    setQuery("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // Active sections, plus any retired one that's still attached (so it can be detached).
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections
      .filter((s) => s.active || current.includes(s.id))
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.key.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sections, current, query]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const removing = current.filter((id) => !selected.has(id)).length;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit([...selected]);
      onOpenChange(false);
    } catch (err) {
      setError(parseTicketError(err, "admin").message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={level !== null} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogShell
        busy={saving}
        title={t("title", { name: level?.name ?? "" })}
        description={t("description")}
        toolbar={
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tc("search")} className="h-8 ps-8" />
          </div>
        }
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground tabular-nums sm:me-auto">
              {t("count", { count: selected.size })}
              {removing > 0 && <span className="text-amber-700 dark:text-amber-300"> · {t("removing", { count: removing })}</span>}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                {tc("cancel")}
              </Button>
              <Button onClick={() => void submit()} disabled={saving}>
                {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {tc("save")}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <FormError message={error} />
          {options.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{tc("noMatches")}</p>
          ) : (
            <ul className="space-y-1">
              {options.map((s) => {
                const on = selected.has(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      disabled={saving}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-start text-sm transition-colors hover:bg-accent",
                        on && "border-primary/40 bg-primary/5",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{s.name}</span>
                        <code className="block truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
                          {s.key}
                        </code>
                      </span>
                      {!s.active && <span className="shrink-0 text-[10px] text-muted-foreground">{t("retired")}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogShell>
    </Dialog>
  );
}
