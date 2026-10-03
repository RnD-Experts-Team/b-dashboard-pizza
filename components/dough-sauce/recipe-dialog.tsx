"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { DoughSauceError } from "@/lib/api/services/dough-sauce.service";
import { INGREDIENT_KEYS } from "@/types/dough-sauce.types";
import type {
  CreateRecipePayload,
  Ingredient,
  IngredientKey,
  Recipe,
  RecipeUpdateResult,
  UpdateRecipePayload,
} from "@/types/dough-sauce.types";
import { fmtQty, useIngredientLabel } from "./ds-ui";

export interface RecipeDraft {
  item_id: string;
  menu_item_name: string;
  menu_item_account: string;
}

type Props =
  | {
      mode: "create";
      open: boolean;
      onOpenChange: (open: boolean) => void;
      ingredients: Ingredient[] | null;
      draft?: Partial<RecipeDraft>;
      onCreate: (payload: CreateRecipePayload) => Promise<void>;
    }
  | {
      mode: "update";
      open: boolean;
      onOpenChange: (open: boolean) => void;
      ingredients: Ingredient[] | null;
      recipe: Recipe | null;
      onUpdate: (id: number, payload: UpdateRecipePayload) => Promise<RecipeUpdateResult>;
    };

function fieldError(err: DoughSauceError | null, field: string): string | undefined {
  if (!err?.fieldErrors) return undefined;
  const hit = Object.entries(err.fieldErrors).find(([k]) => k === field || k.startsWith(`${field}.`));
  return hit?.[1]?.[0];
}

export function RecipeDialog(props: Props) {
  const t = useTranslations("doughSauce.recipes.dialog");
  const labelOf = useIngredientLabel(props.ingredients);
  const [itemId, setItemId] = useState("");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [qtys, setQtys] = useState<Record<IngredientKey, string>>({ dough_18oz: "", dough_10oz: "", sauce: "" });
  const [qty, setQty] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<DoughSauceError | null>(null);
  const [result, setResult] = useState<RecipeUpdateResult | null>(null);

  const draftKey = props.mode === "create" ? JSON.stringify(props.draft ?? {}) : String(props.recipe?.id ?? "");

  useEffect(() => {
    if (!props.open) return;
    setError(null);
    setResult(null);
    setEffectiveFrom("");
    if (props.mode === "create") {
      setItemId(props.draft?.item_id ?? "");
      setName(props.draft?.menu_item_name ?? "");
      setAccount(props.draft?.menu_item_account ?? "");
      setQtys({ dough_18oz: "", dough_10oz: "", sauce: "" });
    } else {
      setQty(props.recipe ? String(props.recipe.qty) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, draftKey]);

  const createLines = INGREDIENT_KEYS.filter((k) => qtys[k].trim() !== "").map((k) => ({
    ingredient_key: k,
    qty: Number(qtys[k]),
  }));
  const createValid =
    itemId.trim() !== "" &&
    name.trim() !== "" &&
    account.trim() !== "" &&
    createLines.length > 0 &&
    createLines.every((l) => Number.isFinite(l.qty) && l.qty > 0);
  const updateValid = qty.trim() !== "" && Number.isFinite(Number(qty)) && Number(qty) > 0;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (props.mode === "create") {
        await props.onCreate({
          item_id: itemId.trim(),
          menu_item_name: name.trim(),
          menu_item_account: account.trim(),
          lines: createLines,
          ...(effectiveFrom && { effective_from: effectiveFrom }),
        });
        toast.success(t("created"));
        props.onOpenChange(false);
      } else if (props.recipe) {
        const res = await props.onUpdate(props.recipe.id, {
          qty: Number(qty),
          ...(effectiveFrom && { effective_from: effectiveFrom }),
        });
        // Show both halves — "changed to X" would hide that the old number
        // still applies to past days (contract §4.2).
        setResult(res);
        toast.success(t("updated"));
      }
    } catch (err) {
      const e = err instanceof DoughSauceError ? err : null;
      setError(e);
      toast.error(e?.message ?? t("failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading font-semibold">
            {props.mode === "create" ? t("createTitle") : t("updateTitle")}
          </DialogTitle>
          <DialogDescription>
            {props.mode === "create" ? t("createDescription") : t("updateDescription")}
          </DialogDescription>
        </DialogHeader>

        {props.mode === "create" ? (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ds-item-id">{t("itemId")}</Label>
                <Input id="ds-item-id" value={itemId} onChange={(e) => setItemId(e.target.value)} />
                {fieldError(error, "item_id") && (
                  <p className="text-xs text-destructive">{fieldError(error, "item_id")}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ds-account">{t("account")}</Label>
                <Input id="ds-account" value={account} onChange={(e) => setAccount(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ds-name">{t("name")}</Label>
              <Input id="ds-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("linesLabel")}</Label>
              <p className="text-xs text-muted-foreground">{t("linesHint")}</p>
              {INGREDIENT_KEYS.map((k) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">{labelOf(k)}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={qtys[k]}
                    onChange={(e) => setQtys((q) => ({ ...q, [k]: e.target.value }))}
                    className="w-28 tabular-nums"
                    aria-label={labelOf(k)}
                  />
                </div>
              ))}
              {fieldError(error, "lines") && <p className="text-xs text-destructive">{fieldError(error, "lines")}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>{t("effectiveFrom")}</Label>
              <DatePicker value={effectiveFrom} onChange={setEffectiveFrom} className="w-full sm:w-44" />
              <p className="text-xs text-muted-foreground">{t("effectiveFromHint")}</p>
            </div>
          </div>
        ) : result ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{t("resultExplanation")}</p>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <div className="flex-1 rounded-lg border bg-muted/40 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("closedRow")}
                </p>
                <p className="text-xl font-semibold tabular-nums">{fmtQty(result.closed.qty)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t("until", { date: result.closed.effective_to })}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 self-center text-muted-foreground rtl:rotate-180" />
              <div className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 dark:bg-emerald-500/15">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {t("openedRow")}
                </p>
                <p className="text-xl font-semibold tabular-nums">{fmtQty(result.opened.qty)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t("from", { date: result.opened.effective_from })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {props.recipe && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-medium">
                  {props.recipe.menu_item_name ?? props.recipe.item_id}{" "}
                  <span className="text-muted-foreground">· {labelOf(props.recipe.ingredient_key)}</span>
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t("currentQty", { qty: fmtQty(props.recipe.qty), date: props.recipe.effective_from })}
                </p>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="ds-qty">{t("newQty")}</Label>
              <Input
                id="ds-qty"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-32 tabular-nums"
              />
              {fieldError(error, "qty") && <p className="text-xs text-destructive">{fieldError(error, "qty")}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>{t("effectiveFrom")}</Label>
              <DatePicker value={effectiveFrom} onChange={setEffectiveFrom} className="w-full sm:w-44" />
              <p className="text-xs text-muted-foreground">{t("updateEffectiveHint")}</p>
              {fieldError(error, "effective_from") && (
                <p className="text-xs text-destructive">{fieldError(error, "effective_from")}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={saving}>
            {result ? t("done") : t("cancel")}
          </Button>
          {!result && (
            <Button
              onClick={submit}
              disabled={saving || (props.mode === "create" ? !createValid : !updateValid)}
            >
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {props.mode === "create" ? t("createSubmit") : t("updateSubmit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
