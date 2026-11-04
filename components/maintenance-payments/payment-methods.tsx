"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { maintenancePaymentsService } from "@/lib/api/services/maintenance-payments.service";
import { useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import type { PaymentMethodOption } from "@/types/maintenance-system";

const NONE = "none";
const CACHE_KEY = "payment-methods";

/** The editable "How we paid" list. */
export function usePaymentMethods(enabled = true) {
  const res = useMaintenanceResource(enabled ? CACHE_KEY : null, (signal) => maintenancePaymentsService.listPaymentMethods(signal));
  return { ...res, methods: res.data ?? [] };
}

/** "How we paid" in the payment dialog: one of the list, or not said. */
export function PaymentMethodSelect({ id, value, onChange }: { id?: string; value: number | null; onChange: (id: number | null) => void }) {
  const t = useTranslations("maintenanceSystem");
  const { methods, isLoading } = usePaymentMethods();
  return (
    <Select value={value == null ? NONE : String(value)} onValueChange={(v) => onChange(v === NONE ? null : Number(v))}>
      <SelectTrigger id={id} className="h-9" aria-label={t("payments.howWePaid")} disabled={isLoading && !methods.length}>
        <SelectValue placeholder={t("payments.methods.notSaid")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("payments.methods.notSaid")}</SelectItem>
        {methods.map((m) => (
          <SelectItem key={m.id} value={String(m.id)}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof MaintenanceTicketsError ? err.message : fallback;
}

/** Add, rename and delete payment methods (a method in use can only be renamed). */
export function PaymentMethodsManager() {
  const t = useTranslations("maintenanceSystem");
  const { methods, isLoading, refresh } = usePaymentMethods();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  async function act(key: number | "new", work: () => Promise<unknown>, done: string) {
    setBusy(key);
    try {
      await work();
      await refresh();
      toast.success(done);
      return true;
    } catch (err) {
      toast.error(errorText(err, t("common.saveError")));
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void (async () => {
            if (await act("new", () => maintenancePaymentsService.createPaymentMethod(name.trim()), t("payments.methods.added"))) setName("");
          })();
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("payments.methods.newPlaceholder")} aria-label={t("payments.methods.new")} className="h-9" />
        <Button type="submit" size="sm" className="h-9" disabled={!name.trim() || busy === "new"}>
          {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          {t("payments.methods.add")}
        </Button>
      </form>
      {isLoading && !methods.length ? <p className="text-sm text-muted-foreground">{t("common.loading")}</p> : null}
      <ul className="divide-y rounded-md border">
        {methods.map((m: PaymentMethodOption) => (
          <li key={m.id} className="flex min-h-11 items-center gap-2 px-3 py-1.5 text-sm">
            {editing?.id === m.id ? (
              <form
                className="flex flex-1 items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!editing.name.trim()) return;
                  void (async () => {
                    const renamed = await act(m.id, () => maintenancePaymentsService.updatePaymentMethod(m.id, { name: editing.name.trim() }), t("payments.methods.renamed"));
                    if (renamed) setEditing(null);
                  })();
                }}
              >
                <Input autoFocus value={editing.name} onChange={(e) => setEditing({ id: m.id, name: e.target.value })} className="h-8" aria-label={t("payments.methods.rename")} />
                <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" aria-label={t("common.save")} disabled={busy === m.id}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={t("common.cancel")} onClick={() => setEditing(null)}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            ) : (
              <>
                <span className="flex-1 font-medium">{m.name}</span>
                {m.paymentsCount ? <span className="text-xs tabular-nums text-muted-foreground">{t("payments.methods.used", { count: m.paymentsCount })}</span> : null}
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("payments.methods.rename")} onClick={() => setEditing({ id: m.id, name: m.name })}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label={t("payments.methods.delete", { name: m.name })}
                  title={m.paymentsCount ? t("payments.methods.inUse") : undefined}
                  disabled={busy === m.id || Boolean(m.paymentsCount)}
                  onClick={() => void act(m.id, () => maintenancePaymentsService.deletePaymentMethod(m.id), t("payments.methods.deleted"))}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </>
            )}
          </li>
        ))}
        {!isLoading && !methods.length ? <li className="px-3 py-4 text-center text-sm text-muted-foreground">{t("payments.methods.empty")}</li> : null}
      </ul>
    </div>
  );
}

/** The list in its own small dialog (the Payments page's "Payment methods" button). */
export function PaymentMethodsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("maintenanceSystem");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading font-semibold">{t("payments.methods.title")}</DialogTitle>
          <DialogDescription>{t("payments.methods.help")}</DialogDescription>
        </DialogHeader>
        {open ? <PaymentMethodsManager /> : null}
      </DialogContent>
    </Dialog>
  );
}
