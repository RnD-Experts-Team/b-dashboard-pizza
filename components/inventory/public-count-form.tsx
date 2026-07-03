"use client";

/* eslint-disable @next/next/no-img-element -- backend images are served via the
   same-origin /inventory-storage proxy; next/image remote config is unnecessary here. */

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  ImageOff,
  Link2Off,
  Loader2,
  PackageCheck,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePublicInventoryLink } from "@/lib/hooks/use-public-inventory";
import type { PublicLinkItem, PublicSubmitItem } from "@/types/inventory.types";

type Counts = Record<number, { u1: string; u2: string; u3: string }>;

/** Full-page states share this centered card shell. */
function CenteredMessage({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
        {icon}
        <h1 className="text-xl font-semibold">{title}</h1>
        {children && <p className="text-sm text-muted-foreground">{children}</p>}
      </div>
    </div>
  );
}

/** Skeleton that mirrors the form's header + item cards + footer layout. */
function PublicCountFormSkeleton() {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      {/* Header skeleton */}
      <div className="shrink-0 border-b bg-background/95 px-4 pb-4 pt-4">
        {/* Branding pill + badge */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        {/* Store name */}
        <Skeleton className="mt-3 h-8 w-56" />
        {/* Employee · date */}
        <Skeleton className="mt-2 h-4 w-44" />
        {/* Progress bar + counter */}
        <div className="mt-3 space-y-1.5">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>

      {/* Item card skeletons */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            {/* Top row: image + info */}
            <div className="flex gap-3">
              <Skeleton className="h-[72px] w-[72px] shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            {/* Bottom row: inputs */}
            <div className="mt-3 flex gap-2">
              {[0, 1].map((j) => (
                <div key={j} className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-11 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer skeleton */}
      <div className="shrink-0 border-t bg-background/90 px-4 py-3">
        <Skeleton className="mx-auto mb-2 h-3 w-32" />
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
    </div>
  );
}

/** Full-screen image lightbox, built on the real Dialog primitive so outside
 *  clicks/Escape/close-button all use Radix's own dismiss handling. */
function ImageLightbox({
  src,
  alt,
  open,
  onOpenChange,
}: {
  src: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-fit max-w-none border-0 bg-transparent p-0 shadow-none sm:max-w-none [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:hover:bg-white/30">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl"
        />
      </DialogContent>
    </Dialog>
  );
}

/** A single unit count field. */
function UnitField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <Label htmlFor={id} className="block text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        placeholder="0"
        className="h-11 w-full text-center text-base"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Human-readable conversion hint, e.g. "1 Carton = 6 Box · 1 Box = 12 Piece". */
function conversionHint(item: PublicLinkItem): string | null {
  const parts: string[] = [];
  const u1 = item.unit_1.name;
  const u2 = item.unit_2.name;
  const u3 = item.unit_3?.name;
  if (u1 && u2 && item.unit_2_per_unit_1) {
    parts.push(`1 ${u1} = ${Number(item.unit_2_per_unit_1)} ${u2}`);
  }
  if (u2 && u3 && item.unit_3_per_unit_2) {
    parts.push(`1 ${u2} = ${Number(item.unit_3_per_unit_2)} ${u3}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/**
 * The public, no-auth inventory count form an employee opens via their link.
 * Loads the token's items, collects counts, and submits once (single-use link).
 */
export function PublicCountForm({ token }: { token: string }) {
  const { link, status, error, submit, isSubmitting, submitError, result } =
    usePublicInventoryLink(token);

  const [counts, setCounts] = useState<Counts>({});
  const [lightboxItem, setLightboxItem] = useState<PublicLinkItem | null>(null);

  const setCount = (
    itemId: number,
    field: "u1" | "u2" | "u3",
    value: string
  ) =>
    setCounts((prev) => ({
      ...prev,
      [itemId]: {
        u1: prev[itemId]?.u1 ?? "",
        u2: prev[itemId]?.u2 ?? "",
        u3: prev[itemId]?.u3 ?? "",
        [field]: value,
      },
    }));

  const toNum = (v: string | undefined) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const itemEntered = (itemId: number) => {
    const c = counts[itemId];
    return toNum(c?.u1) > 0 || toNum(c?.u2) > 0 || toNum(c?.u3) > 0;
  };

  const enteredCount = useMemo(
    () => (link ? link.items.filter((i) => itemEntered(i.id)).length : 0),
    [link, counts] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const payload = useMemo<PublicSubmitItem[]>(() => {
    if (!link) return [];
    return link.items.map((item) => {
      const c = counts[item.id];
      const base: PublicSubmitItem = {
        item_id: item.id,
        count_unit_1: toNum(c?.u1),
        count_unit_2: toNum(c?.u2),
      };
      if (item.unit_3) base.count_unit_3 = toNum(c?.u3);
      return base;
    });
  }, [link, counts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submit(payload);
    } catch {
      // submitError is rendered inline.
    }
  };

  // ── Non-form states ──
  if (status === "loading") {
    return <PublicCountFormSkeleton />;
  }

  if (status === "not_found") {
    return (
      <CenteredMessage
        icon={<Link2Off className="h-10 w-10 text-muted-foreground" />}
        title="Link not found"
      >
        This link is invalid or has been removed. Please request a new one.
      </CenteredMessage>
    );
  }

  if (status === "submitted") {
    return (
      <CenteredMessage
        icon={<CheckCircle2 className="h-10 w-10 text-green-600" />}
        title="Already submitted"
      >
        This link has already been used to submit a count. Each link works only
        once.
      </CenteredMessage>
    );
  }

  if (status === "error") {
    return (
      <CenteredMessage
        icon={<AlertCircle className="h-10 w-10 text-destructive" />}
        title="Something went wrong"
      >
        {error ?? "Please try again later."}
      </CenteredMessage>
    );
  }

  // ── Success screen (after submit) ──
  if (result) {
    return (
      <CenteredMessage
        icon={<PackageCheck className="h-12 w-12 text-green-600" />}
        title="Count submitted"
      >
        Thank you! Your count was recorded as{" "}
        <span className="font-medium text-foreground">{result.reference}</span>.
        You can close this page.
      </CenteredMessage>
    );
  }

  if (!link) return null;

  const total = link.items.length;

  // A true flex column filling the fixed-height <main>: header and submit bar are
  // shrink-0; the item list is the only scrollable region (flex-1 + min-h-0).
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      {/* ── Header ── */}
      <header className="shrink-0 border-b bg-background/95 px-4 pb-4 pt-4">
        {/* Branding pill + type badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <ClipboardList className="h-3.5 w-3.5" />
            Inventory Count
          </div>
          <Badge variant="outline" className="capitalize">
            {link.type}
          </Badge>
        </div>

        {/* Store name */}
        <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight">
          {link.store.name}
        </h1>

        {/* Employee · date */}
        <p className="mt-1 text-sm text-muted-foreground">
          {link.user_name}
          <span className="mx-1.5 opacity-50">·</span>
          {link.date}
        </p>

        {/* Progress bar + counter */}
        {total > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(enteredCount / total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {enteredCount} of {total} item{total === 1 ? "" : "s"} entered
            </p>
          </div>
        )}
      </header>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        {/* Scrollable item list */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {total === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No items are configured for this link.
            </p>
          ) : (
            link.items.map((item) => {
              const entered = itemEntered(item.id);
              const hint = conversionHint(item);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border bg-card p-4 transition-colors duration-200",
                    entered && "border-primary/40 bg-primary/5"
                  )}
                >
                  {/* Top row: image + item info */}
                  <div className="flex gap-3">
                    {/* Image thumbnail — clickable when present */}
                    <div className="relative shrink-0">
                      {item.image ? (
                        <button
                          type="button"
                          className="group relative overflow-hidden rounded-xl border"
                          onClick={() => setLightboxItem(item)}
                          aria-label={`View image for ${item.name_en}`}
                        >
                          <img
                            src={item.image}
                            alt={item.name_en}
                            className="h-[72px] w-[72px] object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                          {/* Zoom indicator — subtle on mobile, prominent on hover */}
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/40 py-1 opacity-60 transition-opacity group-hover:opacity-100">
                            <ZoomIn className="h-3 w-3 text-white" />
                          </div>
                        </button>
                      ) : (
                        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                          <ImageOff className="h-5 w-5" />
                        </div>
                      )}
                      {/* Entered badge on image corner */}
                      {entered && (
                        <div className="absolute -right-1.5 -top-1.5 rounded-full bg-background">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </div>
                      )}
                    </div>

                    {/* Item name, ID, conversion hint */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">{item.name_en}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.ultimatrix_id}
                      </p>
                      {hint && (
                        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
                      )}
                    </div>
                  </div>

                  {/* Bottom row: unit count inputs */}
                  <div className="mt-3 flex gap-2">
                    <UnitField
                      id={`u1-${item.id}`}
                      label={item.unit_1.name ?? "Unit 1"}
                      value={counts[item.id]?.u1 ?? ""}
                      onChange={(v) => setCount(item.id, "u1", v)}
                    />
                    <UnitField
                      id={`u2-${item.id}`}
                      label={item.unit_2.name ?? "Unit 2"}
                      value={counts[item.id]?.u2 ?? ""}
                      onChange={(v) => setCount(item.id, "u2", v)}
                    />
                    {item.unit_3 && (
                      <UnitField
                        id={`u3-${item.id}`}
                        label={item.unit_3.name ?? "Unit 3"}
                        value={counts[item.id]?.u3 ?? ""}
                        onChange={(v) => setCount(item.id, "u3", v)}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pinned submit footer */}
        {total > 0 && (
          <div className="shrink-0 border-t bg-background/90 px-4 py-3">
            <p className="mb-2 text-center text-xs text-muted-foreground">
              {enteredCount} of {total} item{total === 1 ? "" : "s"} entered
            </p>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              size="lg"
            >
              {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Submit count
            </Button>
          </div>
        )}
      </form>

      {/* Image lightbox */}
      {lightboxItem?.image && (
        <ImageLightbox
          src={lightboxItem.image}
          alt={lightboxItem.name_en}
          open={lightboxItem !== null}
          onOpenChange={(o) => !o && setLightboxItem(null)}
        />
      )}
    </div>
  );
}
