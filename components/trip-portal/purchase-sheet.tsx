"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { tripPortalService } from "@/lib/hooks/use-trip-portal";
import { cn } from "@/lib/utils";
import type { IdName, PublicTrip } from "@/types/maintenance-system";
import { BIG_INPUT, BigButton, BigField, PhotoField, PortalSheet, usePortalErrorText } from "./portal-bits";
import type { PortalRun } from "./portal-sheets";

const SEARCH_DELAY_MS = 300;
const MAX_MATCHES = 6;
const DECIMAL_INPUT = "decimal";
/**
 * A money amount: digits with at most one dot and up to 2 decimals.
 * Matches "12", "12.5", "12.50", ".5"; rejects "12.505", "1,200", "abc".
 * https://regex101.com/?flavor=javascript&regex=%5E(%5Cd%2B(%5C.%5Cd%7B0%2C2%7D)%3F%7C%5C.%5Cd%7B1%2C2%7D)%24&testString=12%0A12.5%0A12.50%0A.5%0A12.505%0A1%2C200%0Aabc
 */
const MONEY_PATTERN = /^(\d+(\.\d{0,2})?|\.\d{1,2})$/;

/**
 * "I bought something" (UI doc §4): what, cost, where (a known supplier
 * or a new name — created upstream), receipt photo, which job, serial.
 */
export function PurchaseSheet({
  open,
  onOpenChange,
  trip,
  token,
  run,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trip: PublicTrip;
  token: string;
  run: PortalRun;
}) {
  const t = useTranslations("maintenanceSystem");
  return (
    <PortalSheet open={open} onOpenChange={onOpenChange} title={t("tripPortal.boughtSomething")}>
      <PurchaseForm trip={trip} token={token} run={run} onDone={() => onOpenChange(false)} />
    </PortalSheet>
  );
}

type Errors = Partial<Record<"description" | "total_cost" | "supplier" | "form", string>>;

function PurchaseForm({ trip, token, run, onDone }: { trip: PublicTrip; token: string; run: PortalRun; onDone: () => void }) {
  const t = useTranslations("maintenanceSystem");
  const errorText = usePortalErrorText();
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [supplierText, setSupplierText] = useState("");
  const [supplier, setSupplier] = useState<IdName | null>(null);
  const [matches, setMatches] = useState<IdName[]>([]);
  const [receipt, setReceipt] = useState<File[]>([]);
  const [issueId, setIssueId] = useState<number | null>(null);
  const [serial, setSerial] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      abort.current?.abort();
    },
    [],
  );

  const jobs = trip.stops
    .filter((s) => !s.mistaken)
    .flatMap((s) => s.issues.map((i) => ({ id: i.ticketIssueId, title: i.title, store: s.store?.storeNumber ?? s.otherStore })));

  function searchSuppliers(text: string): void {
    setSupplierText(text);
    setSupplier(null);
    if (timer.current) window.clearTimeout(timer.current);
    abort.current?.abort();
    if (!text.trim()) {
      setMatches([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      const controller = new AbortController();
      abort.current = controller;
      try {
        const rows = await tripPortalService.searchSuppliers(token, text.trim(), controller.signal);
        if (!controller.signal.aborted) setMatches(rows.slice(0, MAX_MATCHES));
      } catch {
        // Suggestions are a convenience: a failed lookup leaves the typed name as a new supplier.
        if (!controller.signal.aborted) setMatches([]);
      }
    }, SEARCH_DELAY_MS);
  }

  async function submit(): Promise<void> {
    const local: Errors = {};
    if (!description.trim()) local.description = t("tripPortal.sayWhatBought");
    if (!MONEY_PATTERN.test(cost.trim())) local.total_cost = t("tripPortal.costNeeded");
    if (Object.keys(local).length) {
      setErrors(local);
      document.getElementById(local.description ? "buy-description" : "buy-cost")?.focus();
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await run((tok) =>
        tripPortalService.addPurchase(tok, {
          description: description.trim(),
          totalCost: cost.trim(),
          supplierId: supplier?.id ?? null,
          supplierName: supplier ? null : supplierText.trim() || null,
          ticketIssueId: issueId,
          serialNumber: serial.trim() || null,
          receipt,
        }),
      );
      toast.success(t("tripPortal.purchaseSaved"));
      onDone();
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  const exact = matches.some((m) => m.name.toLowerCase() === supplierText.trim().toLowerCase());

  return (
    <>
      <BigField label={t("tripPortal.whatBought")} htmlFor="buy-description" required error={errors.description}>
        <Input id="buy-description" className={BIG_INPUT} value={description} onChange={(e) => setDescription(e.target.value)} />
      </BigField>
      <BigField label={t("tripPortal.cost")} htmlFor="buy-cost" required error={errors.total_cost}>
        <div className="relative">
          <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground" aria-hidden="true">
            $
          </span>
          <Input
            id="buy-cost"
            inputMode={DECIMAL_INPUT}
            autoComplete="off"
            className={cn(BIG_INPUT, "ps-9 tabular-nums")}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
      </BigField>
      <BigField label={t("tripPortal.where")} htmlFor="buy-supplier" help={t("tripPortal.whereHelp")}>
        <Input
          id="buy-supplier"
          autoComplete="off"
          className={BIG_INPUT}
          value={supplier ? supplier.name : supplierText}
          onChange={(e) => searchSuppliers(e.target.value)}
        />
        {!supplier && !!supplierText.trim() && (
          <ul className="space-y-2 pt-1">
            {matches.map((m) => (
              <li key={m.id}>
                <BigButton
                  type="button"
                  variant="outline"
                  className="justify-start"
                  icon={<Check aria-hidden="true" />}
                  onClick={() => {
                    setSupplier(m);
                    setSupplierText(m.name);
                    setMatches([]);
                  }}
                >
                  {m.name}
                </BigButton>
              </li>
            ))}
            {!exact && (
              <li className="flex min-h-12 items-center gap-2 rounded-xl bg-muted/40 px-4 text-base text-muted-foreground">
                <Plus className="size-5 shrink-0" aria-hidden="true" />
                {t("tripPortal.newSupplier", { name: supplierText.trim() })}
              </li>
            )}
          </ul>
        )}
      </BigField>
      <PhotoField label={t("tripPortal.receipt")} files={receipt} onChange={setReceipt} />
      {!!jobs.length && (
        <BigField label={t("tripPortal.whichTicket")}>
          <div className="space-y-2">
            {[{ id: null as number | null, title: t("tripPortal.noTicket"), store: null as string | null }, ...jobs].map((job) => (
              <button
                key={job.id ?? "none"}
                type="button"
                aria-pressed={issueId === job.id}
                onClick={() => setIssueId(job.id)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-2 rounded-xl border-2 px-4 text-start text-base font-medium",
                  issueId === job.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{job.title}</span>
                {job.store && <span className="shrink-0 text-sm opacity-80">{t("trips.storeN", { number: job.store })}</span>}
              </button>
            ))}
          </div>
        </BigField>
      )}
      {showMore ? (
        <BigField label={`${t("tripPortal.serial")} (${t("common.optional")})`} htmlFor="buy-serial">
          <Input id="buy-serial" autoComplete="off" className={BIG_INPUT} value={serial} onChange={(e) => setSerial(e.target.value)} />
        </BigField>
      ) : (
        <BigButton type="button" variant="ghost" onClick={() => setShowMore(true)}>
          {t("common.moreDetails")}
        </BigButton>
      )}
      {errors.form && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-base font-medium text-destructive">
          {errors.form}
        </p>
      )}
      <BigButton size="giant" icon={<ShoppingBag aria-hidden="true" />} busy={busy} onClick={() => void submit()}>
        {t("tripPortal.savePurchase")}
      </BigButton>
    </>
  );
}
