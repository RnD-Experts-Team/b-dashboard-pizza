"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { maintenanceWorkflowService, type IssueKey } from "@/lib/api/services/maintenance-workflow.service";
import { storageService } from "@/lib/api/services/storage.service";
import { useParts, usePartUnits } from "@/lib/hooks/use-maintenance-catalog";
import { formatQuantity, parseDecimal } from "@/lib/maintenance/money";
import type { StockBalance } from "@/types/storage.types";
import { PasteFileZone } from "../../paste-file-zone";
import { ActionDialog, Field, useDialogSubmit } from "../dialog-kit";
import { localNow } from "../format";

/* ── Add update: a note + photos + who can see it ────────────────────────── */

type Audience = "everyone" | "mos";

export function AddUpdateDialog({
  open,
  onOpenChange,
  issueKey,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueKey: IssueKey | null;
  onSaved: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const form = useDialogSubmit();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [audience, setAudience] = useState<Audience>("everyone");
  const choices: { value: Audience; label: string; help: string; Icon: typeof Users }[] = [
    { value: "everyone", label: t("tickets.dialogs.update.everyone"), help: t("tickets.dialogs.update.everyoneHelp"), Icon: Users },
    { value: "mos", label: t("tickets.dialogs.update.mosOnly"), help: t("tickets.dialogs.update.mosOnlyHelp"), Icon: Lock },
  ];

  async function onSubmit() {
    if (!issueKey) return;
    if (!body.trim()) return form.setFieldErrors({ body: t("tickets.dialogs.update.bodyRequired") });
    const ok = await form.submit(
      () => maintenanceWorkflowService.addNote(issueKey, { body: body.trim(), isPrivate: audience === "mos", files }),
      t("tickets.dialogs.update.saved"),
    );
    if (!ok) return;
    setBody("");
    setFiles([]);
    setAudience("everyone");
    onSaved();
    onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={Boolean(body.trim() || files.length)}
      title={t("workflow.addUpdate")}
      description={t("tickets.dialogs.update.help")}
      submitLabel={t("tickets.dialogs.update.submit")}
      onSubmit={() => void onSubmit()}
    >
      <Field id="update-body" label={t("common.note")} required error={form.fieldError("body")}>
        <Textarea
          id="update-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-24"
          placeholder={t("tickets.dialogs.update.placeholder")}
          aria-invalid={Boolean(form.fieldError("body")) || undefined}
        />
      </Field>
      <Field label={t("common.photos")} error={form.fieldError("files")}>
        <PasteFileZone files={files} onChange={setFiles} />
      </Field>
      <Field label={t("tickets.dialogs.update.whoSees")}>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("tickets.dialogs.update.whoSees")}>
          {choices.map(({ value, label, help, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={audience === value}
              onClick={() => setAudience(value)}
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                audience === value ? "border-primary bg-primary/5" : "hover:bg-muted/50",
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{help}</span>
              </span>
            </button>
          ))}
        </div>
      </Field>
    </ActionDialog>
  );
}

/* ── Use parts from storage: a `used` stock movement on this issue ───────── */

const BALANCE_PAGE_SIZE = 200;
const USED_DIRECTION = -1;

export function UsePartsDialog({
  open,
  onOpenChange,
  ticketIssueId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketIssueId: number;
  onSaved: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const form = useDialogSubmit();
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [serials, setSerials] = useState<string[]>([]);
  const { parts } = useParts();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const res = await storageService.getStockBalances({ non_zero: true, per_page: BALANCE_PAGE_SIZE }, controller.signal);
        setBalances(res.data.filter((b) => b.onHand > 0));
        setLoadError(null);
      } catch (err) {
        if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
        setLoadError(err instanceof Error ? err.message : t("common.loadError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [open, t]);

  const balance = balances.find((b) => String(b.id) === picked) ?? null;
  const part = useMemo(() => parts.find((p) => p.id === balance?.partId) ?? null, [parts, balance]);
  const tracksSerials = Boolean(part?.trackSerials);
  const { units } = usePartUnits(tracksSerials ? (balance?.partId ?? null) : null, "in_stock");
  const unitsHere = units.filter((u) => u.storageLocation?.id === balance?.storageLocationId);
  const qty = tracksSerials ? serials.length : (parseDecimal(quantity) ?? 0);

  async function onSubmit() {
    const missing: Record<string, string> = {};
    if (!balance) missing.part = t("tickets.dialogs.parts.pickRequired");
    if (qty <= 0) missing["lines.0.quantity"] = t("tickets.dialogs.parts.quantityRequired");
    if (balance && qty > balance.onHand) missing["lines.0.quantity"] = t("tickets.dialogs.parts.tooMany", { count: formatQuantity(balance.onHand) });
    if (Object.keys(missing).length) return form.setFieldErrors(missing);
    const chosen = balance as StockBalance;
    const ok = await form.submit(
      () =>
        storageService.createStockMovement({
          moved_at: localNow(),
          type: "used",
          ticket_issue_id: ticketIssueId,
          lines: [
            {
              part_id: chosen.partId,
              storage_location_id: chosen.storageLocationId,
              quantity: qty,
              direction: USED_DIRECTION,
              ...(tracksSerials ? { serials } : {}),
            },
          ],
        }),
      t("tickets.dialogs.parts.saved"),
    );
    if (!ok) return;
    onSaved();
    onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={Boolean(picked)}
      title={t("tickets.work.useParts")}
      description={t("tickets.dialogs.parts.help")}
      submitLabel={t("tickets.dialogs.parts.submit")}
      canSubmit={!loading && balances.length > 0}
      onSubmit={() => void onSubmit()}
    >
      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
      {!loading && !loadError && balances.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("tickets.dialogs.parts.noStock")}</p>
      ) : null}
      <Field label={t("tickets.dialogs.parts.part")} required error={form.fieldError("part") ?? form.fieldError("lines.0.part_id")}>
        <Select
          value={picked}
          onValueChange={(v) => {
            setPicked(v);
            setSerials([]);
          }}
          disabled={loading}
        >
          <SelectTrigger aria-label={t("tickets.dialogs.parts.part")} aria-invalid={Boolean(form.fieldError("part")) || undefined}>
            <SelectValue placeholder={loading ? t("tickets.picker.loading") : t("tickets.dialogs.parts.pick")} />
          </SelectTrigger>
          <SelectContent>
            {balances.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {t("tickets.dialogs.parts.option", {
                  part: b.part?.name ?? `#${b.partId}`,
                  location: b.storageLocation?.name ?? `#${b.storageLocationId}`,
                  count: formatQuantity(b.onHand),
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {balance && tracksSerials ? (
        <Field label={t("tickets.dialogs.parts.serials")} required help={t("tickets.dialogs.parts.serialsHelp")} error={form.fieldError("lines.0.quantity") ?? form.fieldError("lines.0.serials")}>
          <div className="max-h-48 divide-y overflow-y-auto rounded-md border" tabIndex={-1} aria-invalid={Boolean(form.fieldError("lines.0.quantity")) || undefined}>
            {unitsHere.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">{t("tickets.dialogs.parts.noSerials")}</p>
            ) : (
              unitsHere.map((u) => {
                const on = serials.includes(u.serialNumber);
                return (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setSerials((prev) => (on ? prev.filter((s) => s !== u.serialNumber) : [...prev, u.serialNumber]))}
                    />
                    <span className="font-mono text-xs">{u.serialNumber}</span>
                  </label>
                );
              })
            )}
          </div>
        </Field>
      ) : null}
      {balance && !tracksSerials ? (
        <Field
          id="parts-qty"
          label={t("tickets.dialogs.parts.quantity")}
          required
          help={t("tickets.dialogs.parts.onHand", { count: formatQuantity(balance.onHand) })}
          error={form.fieldError("lines.0.quantity")}
        >
          <Input
            id="parts-qty"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-32 tabular-nums"
            aria-invalid={Boolean(form.fieldError("lines.0.quantity")) || undefined}
          />
        </Field>
      ) : null}
    </ActionDialog>
  );
}
