"use client";

import { useMemo, useState } from "react";
import { useDoughSauceAccess } from "@/lib/hooks/use-dough-sauce-access";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BookOpen, CalendarDays, History, Pencil, Plus, RefreshCw, Search, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DoughSauceError } from "@/lib/api/services/dough-sauce.service";
import { useIngredients, useRecipes } from "@/lib/hooks/use-dough-sauce";
import { todayIso } from "@/lib/dough-sauce/dates";
import { recipeStatus, type RecipeStatus } from "@/lib/dough-sauce/recipe-status";
import { INGREDIENT_KEYS, type IngredientKey, type Recipe } from "@/types/dough-sauce.types";
import { DsErrorState, PaginationFooter, fmtQty, useIngredientLabel, usePaged } from "./ds-ui";
import { RecipeDialog } from "./recipe-dialog";

interface ItemGroup {
  itemId: string;
  name: string | null;
  account: string | null;
  /** Every row for this item, per ingredient — newest first (history mode can hold several). */
  byKey: Record<IngredientKey, Recipe[]>;
}

const ALL_ACCOUNTS = "__all__";

/** §4.2 / §8.4 — recipe maintenance. Changes are dated, never overwritten. */
export function RecipesView() {
  const t = useTranslations("doughSauce.recipes");
  const tc = useTranslations("doughSauce.common");
  const [asOf, setAsOf] = useState(todayIso());
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState<string>(ALL_ACCOUNTS);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [closing, setClosing] = useState<Recipe | null>(null);
  const [closingBusy, setClosingBusy] = useState(false);
  const { can } = useDoughSauceAccess();
  const { ingredients } = useIngredients();
  const labelOf = useIngredientLabel(ingredients);
  const { data, error, loading, reload, create, update, close } = useRecipes(asOf, all);

  /** One row per menu item — a recipe IS the set of its ingredient lines. */
  const allGroups = useMemo(() => {
    const byItem = new Map<string, ItemGroup>();
    for (const r of data ?? []) {
      const g =
        byItem.get(r.item_id) ??
        ({
          itemId: r.item_id,
          name: r.menu_item_name ?? null,
          account: r.menu_item_account ?? null,
          byKey: { dough_18oz: [], dough_10oz: [], sauce: [] },
        } satisfies ItemGroup);
      g.byKey[r.ingredient_key]?.push(r);
      byItem.set(r.item_id, g);
    }
    for (const g of byItem.values())
      for (const k of INGREDIENT_KEYS) g.byKey[k].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    return [...byItem.values()].sort((a, b) => (a.name ?? a.itemId).localeCompare(b.name ?? b.itemId));
  }, [data]);

  const accounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of allGroups) if (g.account) m.set(g.account, (m.get(g.account) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [allGroups]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allGroups.filter(
      (g) =>
        (account === ALL_ACCOUNTS || g.account === account) &&
        (!q || g.itemId.toLowerCase().includes(q) || (g.name ?? "").toLowerCase().includes(q))
    );
  }, [allGroups, query, account]);

  const paged = usePaged(groups, 20, `${query}|${account}|${all}|${asOf}`);

  const perIngredient = useMemo(() => {
    const c: Record<IngredientKey, number> = { dough_18oz: 0, dough_10oz: 0, sauce: 0 };
    for (const g of groups) for (const k of INGREDIENT_KEYS) if (g.byKey[k].length) c[k]++;
    return c;
  }, [groups]);

  const onClose = async () => {
    if (!closing) return;
    setClosingBusy(true);
    try {
      await close(closing.id);
      toast.success(t("closed"));
      setClosing(null);
    } catch (err) {
      toast.error(err instanceof DoughSauceError ? err.message : t("closeFailed"));
    } finally {
      setClosingBusy(false);
    }
  };

  const today = todayIso();

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} className="ps-8" />
        </div>
        <ModeSwitch history={all} onChange={setAll} />
        {/* History ignores the date, so the picker only exists in "On a date". */}
        {!all && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("asOf")}</span>
            <DatePicker value={asOf} onChange={(v) => v && setAsOf(v)} className="w-40" />
            {asOf !== today && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setAsOf(today)}>
                {t("today")}
              </Button>
            )}
          </div>
        )}
        <div className="ms-auto flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={reload} disabled={loading} aria-label={tc("refresh")}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          {can.addRecipe && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="me-1.5 h-4 w-4" />
              {t("add")}
            </Button>
          )}
        </div>
      </div>

      {/* Account filter */}
      {accounts.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {[[ALL_ACCOUNTS, allGroups.length] as const, ...accounts].map(([acc, n]) => (
            <button
              key={acc}
              type="button"
              onClick={() => setAccount(acc)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                account === acc
                  ? "border-foreground/20 bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {acc === ALL_ACCOUNTS ? t("allAccounts") : acc}
              <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>
      )}

      {error && !data && <DsErrorState error={error} onRetry={reload} />}
      {loading && !data && !error && <Skeleton className="h-96 w-full" />}

      {data &&
        (groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <Card className="gap-0 overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b bg-muted/30">
                  <tr className="text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-start font-medium">
                      {t("colItem")}
                      <span className="ms-1.5 tabular-nums opacity-70">{groups.length}</span>
                    </th>
                    {INGREDIENT_KEYS.map((k) => (
                      <th key={k} className="w-40 px-3 py-2 text-end font-medium">
                        {labelOf(k)}
                        <span className="ms-1.5 tabular-nums opacity-70">{perIngredient[k]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paged.pageItems.map((g) => {
                    // History: an item whose every version has ended is dimmed as a whole.
                    const inactive =
                      all && INGREDIENT_KEYS.every((k) => g.byKey[k].every((r) => recipeStatus(r, today) === "ended"));
                    return (
                      <tr key={g.itemId} className={cn("hover:bg-muted/30", inactive && "opacity-60")}>
                        <td className="px-4 py-2">
                          <span className="block truncate font-medium">{g.name ?? g.itemId}</span>
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {g.itemId}
                            {g.account && <span className="ms-1.5 rounded bg-muted px-1 py-px text-[10px]">{g.account}</span>}
                          </span>
                        </td>
                        {INGREDIENT_KEYS.map((k) => (
                          <td key={k} className="px-3 py-2 text-end align-middle">
                            {g.byKey[k].length === 0 ? (
                              <span className="text-muted-foreground/40">·</span>
                            ) : (
                              <div className="flex flex-col items-end gap-1.5">
                                {g.byKey[k].map((r) => (
                                  <RecipeCell
                                    key={r.id}
                                    recipe={r}
                                    status={recipeStatus(r, today)}
                                    showDates={all}
                                    versioned={g.byKey[k].length > 1}
                                    onEdit={can.editRecipe ? () => setEditing(r) : undefined}
                                    onClose={can.closeRecipe ? () => setClosing(r) : undefined}
                                  />
                                ))}
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationFooter {...paged} />
          </Card>
        ))}

      <RecipeDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} ingredients={ingredients} onCreate={create} />
      <RecipeDialog
        mode="update"
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        ingredients={ingredients}
        recipe={editing}
        onUpdate={update}
      />
      <AlertDialog open={closing !== null} onOpenChange={(o) => !o && setClosing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-semibold">{t("closeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("closeDescription", {
                item: closing?.menu_item_name ?? closing?.item_id ?? "",
                ingredient: closing ? labelOf(closing.ingredient_key) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closingBusy}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onClose();
              }}
              disabled={closingBusy}
            >
              {t("closeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Small marker beside a quantity: filled = applies now, ring = ended, sky = not started. Named for screen readers. */
function StatusDot({ status }: { status: RecipeStatus }) {
  const t = useTranslations("doughSauce.recipes.status");
  return (
    <span
      role="img"
      aria-label={t(status)}
      title={t(status)}
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        status === "current" && "bg-emerald-500",
        status === "upcoming" && "bg-sky-500",
        status === "ended" && "border border-muted-foreground/60"
      )}
    />
  );
}

/** Two named views instead of a bare switch — neither one is a hidden extra. */
function ModeSwitch({ history, onChange }: { history: boolean; onChange: (history: boolean) => void }) {
  const t = useTranslations("doughSauce.recipes");
  const options = [
    { history: false, icon: CalendarDays, label: t("modeDate") },
    { history: true, icon: History, label: t("modeHistory") },
  ];
  return (
    <div role="radiogroup" aria-label={t("modeLabel")} className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {options.map(({ history: value, icon: Icon, label }) => {
        const active = history === value;
        return (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One version of one ingredient quantity. Actions stay out of the way until hovered (always shown on touch).
 * The live number is the strongest thing in the cell; ended ones step back. A date line appears only where
 * it says something — a version that ended or hasn't started, or a cell holding more than one version.
 */
function RecipeCell({
  recipe,
  status,
  showDates,
  versioned,
  onEdit,
  onClose,
}: {
  recipe: Recipe;
  status: RecipeStatus;
  showDates: boolean;
  versioned: boolean;
  onEdit?: () => void;
  onClose?: () => void;
}) {
  const t = useTranslations("doughSauce.recipes");
  const closed = status === "ended";
  const range = `${recipe.effective_from} → ${recipe.effective_to ?? t("open")}`;
  const showMeta = showDates && (status !== "current" || versioned);
  return (
    <div className={cn("group/cell flex items-center justify-end gap-1", closed && "text-muted-foreground")}>
      {!closed && (onEdit || onClose) && (
        <span className="flex opacity-100 transition-opacity sm:opacity-0 sm:group-hover/cell:opacity-100 sm:focus-within:opacity-100">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("change")}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              aria-label={t("close")}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      )}
      <span className="flex flex-col items-end leading-tight">
        <span className="flex items-center gap-1.5">
          {(showDates || status !== "current") && <StatusDot status={status} />}
          <span
            title={range}
            className={cn(
              "font-semibold tabular-nums",
              closed && "text-xs font-medium line-through decoration-muted-foreground/50"
            )}
          >
            {fmtQty(recipe.qty)}
          </span>
        </span>
        {showMeta && <span className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">{range}</span>}
      </span>
    </div>
  );
}
