"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cleaningService, CleaningError } from "@/lib/api/services/cleaning.service";
import { formatScorePct } from "./cleaning-ui";
import type { CleaningSettings } from "@/types/cleaning.types";

/**
 * Purely illustrative numbers for the live example below — never used to
 * score a real evaluation, chosen unequal on purpose so moving the slider
 * visibly changes the example.
 */
const EXAMPLE_ITEM_SCORE = 85;
const EXAMPLE_CHART_SCORE = 60;

/**
 * Gated by the "cleaning specialist" permission (visibility controlled by the
 * caller via `canManageCleaningSettings`) — confirmed against the live
 * permission registry, not Super Admin only as the migration guide's prose
 * implied.
 *
 * The backend still supports a legacy "excel" formula (guide §9), but this
 * dialog deliberately only ever offers/saves "average" — there's no product
 * reason to let anyone switch back to the pre-migration formula from here.
 * If `GET /settings` ever returns "excel" (e.g. set some other way), saving
 * from this dialog corrects it back to "average".
 *
 * `items_share`/`chart_share` are edited as ONE slider rather than two number
 * inputs — moving it always derives the other side so an unbalanced pair
 * (e.g. a `60`/`60` typo) can never be expressed client-side, matching the
 * guide's own suggestion (§9). The server's exact-100 check (422 otherwise)
 * still applies as a backstop, not the only guard.
 */
export function CleaningSettingsDialog() {
  const t = useTranslations("cleaningChart.settingsDialog");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CleaningError | null>(null);
  const [settings, setSettings] = useState<CleaningSettings | null>(null);
  const [itemsShare, setItemsShare] = useState(50);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    cleaningService
      .getSettings()
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        // Belt-and-suspenders: `transformSettings` already guarantees a
        // finite number, but never let a slider render `NaN` either way.
        setItemsShare(Number.isFinite(s.itemsShare) ? s.itemsShare : 50);
      })
      .catch((err) => {
        if (!cancelled && err instanceof CleaningError) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const chartShare = 100 - itemsShare;
  const examplePreview =
    (EXAMPLE_ITEM_SCORE * itemsShare + EXAMPLE_CHART_SCORE * chartShare) / 100;
  const dirty =
    settings != null &&
    (settings.scoreFormula !== "average" || itemsShare !== settings.itemsShare);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await cleaningService.updateSettings({
        score_formula: "average",
        items_share: itemsShare,
        chart_share: chartShare,
      });
      setSettings(updated);
      toast.success(t("saved"));
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title={t("trigger")}>
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {loading && !settings ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error && !settings ? (
          <p className="py-6 text-center text-sm text-destructive">{error.message}</p>
        ) : settings ? (
          <div className="space-y-6">
            {/* Deliberately our own copy, not the server's raw `explain` text —
                that text still describes the "excel" formula this dialog no
                longer offers, which would confuse rather than clarify. */}
            <p className="text-xs text-muted-foreground">{t("formulaAverageHint")}</p>

            {/* Items / Chart split */}
            <div className="space-y-3 border-t pt-5">
              <Label className="text-sm font-semibold">{t("sharesLabel")}</Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("sharesItemsEnd")}
                  </p>
                  <p className="text-xl font-bold tabular-nums">{itemsShare}%</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("sharesChartEnd")}
                  </p>
                  <p className="text-xl font-bold tabular-nums">{chartShare}%</p>
                </div>
              </div>

              <Slider
                value={[itemsShare]}
                onValueChange={([v]) => setItemsShare(v)}
                min={0}
                max={100}
                step={1}
                disabled={saving}
              />

              {(settings.explain.items_share || settings.explain.chart_share) && (
                <p className="text-xs text-muted-foreground">
                  {settings.explain.items_share ?? settings.explain.chart_share}
                </p>
              )}

              {/* Live example — makes the abstract percentage tangible.
                  Purely illustrative arithmetic, never a real score. */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                <p className="font-medium text-foreground">{t("previewTitle")}</p>
                <p className="mt-1 text-muted-foreground">
                  {t("previewBody", {
                    itemScore: EXAMPLE_ITEM_SCORE,
                    chartScore: EXAMPLE_CHART_SCORE,
                    result: formatScorePct(examplePreview),
                  })}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            {t("close")}
          </Button>
          <Button onClick={handleSave} disabled={!settings || saving || !dirty}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
