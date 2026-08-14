"use client";

/* eslint-disable @next/next/no-img-element -- backend images are served via the
   same-origin /inventory-storage proxy; next/image remote config is unnecessary here. */

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ImageOff,
  Link2Off,
  Loader2,
  PackageCheck,
  X,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { usePublicInventoryLink } from "@/lib/hooks/use-public-inventory";
import type { PublicLinkItem, PublicSubmitItem } from "@/types/inventory.types";

type Counts = Record<number, { u1: string; u2: string; u3: string }>;
type Lang = "en" | "ar" | "es";

const T: Record<
  Lang,
  {
    inventoryCount: string;
    itemsEntered: (entered: number, total: number) => string;
    noItems: string;
    submitBtn: string;
    confirmTitle: string;
    confirmDescription: (entered: number, total: number) => string;
    reviewAgain: string;
    countSubmitted: string;
    thankYouPrefix: string;
    thankYouSuffix: string;
    filterByCategory: string;
    allCategories: string;
    uncategorized: string;
  }
> = {
  en: {
    inventoryCount: "Inventory Count",
    itemsEntered: (e, t) => `${e} of ${t} item${t === 1 ? "" : "s"} entered`,
    noItems: "No items are configured for this link.",
    submitBtn: "Submit count",
    confirmTitle: "Submit this count?",
    confirmDescription: (e, t) =>
      `You have entered ${e} of ${t} item${t === 1 ? "" : "s"}. This link can only be submitted once and can't be changed afterwards.`,
    reviewAgain: "Review again",
    countSubmitted: "Count submitted",
    thankYouPrefix: "Thank you! Your count was recorded as ",
    thankYouSuffix: ". You can close this page.",
    filterByCategory: "Filter by category",
    allCategories: "All",
    uncategorized: "Uncategorized",
  },
  ar: {
    inventoryCount: "جرد المخزون",
    itemsEntered: (e, t) => `تم إدخال ${e} من ${t} ${t === 1 ? "عنصر" : "عناصر"}`,
    noItems: "لا توجد عناصر مضافة لهذا الرابط.",
    submitBtn: "إرسال الجرد",
    confirmTitle: "إرسال هذا الجرد؟",
    confirmDescription: (e, t) =>
      `لقد أدخلت ${e} من ${t} ${t === 1 ? "عنصر" : "عناصر"}. لا يمكن إرسال هذا الرابط إلا مرة واحدة ولا يمكن تعديله بعد الإرسال.`,
    reviewAgain: "مراجعة مرة أخرى",
    countSubmitted: "تم إرسال الجرد",
    thankYouPrefix: "شكراً لك! تم تسجيل الجرد بالرقم ",
    thankYouSuffix: ". يمكنك إغلاق هذه الصفحة.",
    filterByCategory: "تصفية حسب الفئة",
    allCategories: "الكل",
    uncategorized: "غير مصنّف",
  },
  es: {
    inventoryCount: "Conteo de Inventario",
    itemsEntered: (e, t) =>
      `${e} de ${t} artículo${t === 1 ? "" : "s"} ingresado${t === 1 ? "" : "s"}`,
    noItems: "No hay artículos configurados para este enlace.",
    submitBtn: "Enviar conteo",
    confirmTitle: "¿Enviar este conteo?",
    confirmDescription: (e, t) =>
      `Ha ingresado ${e} de ${t} artículo${t === 1 ? "" : "s"}. Este enlace solo se puede enviar una vez y no se puede modificar después.`,
    reviewAgain: "Revisar de nuevo",
    countSubmitted: "Conteo enviado",
    thankYouPrefix: "¡Gracias! Tu conteo fue registrado como ",
    thankYouSuffix: ". Puedes cerrar esta página.",
    filterByCategory: "Filtrar por categoría",
    allCategories: "Todos",
    uncategorized: "Sin categoría",
  },
};

/** A category filter — "all" | "uncategorized" | a real tag id. */
type CategoryFilter = "all" | "uncategorized" | number;

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
      <DialogContent
        showCloseButton={false}
        className="w-fit max-w-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogClose className="absolute -top-11 end-0 rounded-full bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30">
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </DialogClose>
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
  // Count supports up to 2 decimals; custom steppers (native number arrows
  // aren't shown on mobile, and we hide them anyway to avoid double arrows on
  // desktop) still step by whole units for quick entry.
  const current = Number.parseFloat(value || "0") || 0;
  const step = (delta: number) =>
    onChange(String(Math.round(Math.max(0, current + delta) * 100) / 100));

  return (
    <div className="min-w-0 flex-1 space-y-1">
      <Label htmlFor={id} className="block text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0.00"
          className="h-11 w-full pe-7 text-center text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={value}
          onKeyDown={(e) => {
            // Up to 2 decimals — block thousands separators / exponent / sign.
            if ([",", "e", "E", "+", "-"].includes(e.key)) e.preventDefault();
          }}
          onChange={(e) => onChange(e.target.value)}
        />
        {/* Always-visible stepper arrows (works on touch + desktop). */}
        <div className="absolute inset-y-1 end-1 flex flex-col overflow-hidden rounded-md border">
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Increase ${label}`}
            className="flex flex-1 items-center justify-center px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => step(1)}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Decrease ${label}`}
            disabled={current <= 0}
            className="flex flex-1 items-center justify-center border-t px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            onClick={() => step(-1)}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  // Unique categories across all items, plus an "uncategorized" bucket if any
  // item has no tags. Built from whatever the link already returned — there's
  // no separate categories endpoint.
  const categories = useMemo(() => {
    if (!link) return { tags: [] as { id: number; name: string }[], hasUncategorized: false };
    const byId = new Map<number, { id: number; name: string }>();
    let hasUncategorized = false;
    for (const item of link.items) {
      if (item.tags.length === 0) hasUncategorized = true;
      for (const tag of item.tags) byId.set(tag.id, tag);
    }
    return {
      tags: Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)),
      hasUncategorized,
    };
  }, [link]);

  // Items sliced into per-category sections (a tagged item can appear in more
  // than one section) instead of one flat list — the dropdown then just picks
  // which section(s) are visible; sections themselves never get unmounted.
  const sections = useMemo(() => {
    if (!link) return [];
    const tagSections = categories.tags.map((tag) => ({
      key: tag.id as CategoryFilter,
      label: tag.name,
      items: link.items.filter((i) => i.tags.some((t) => t.id === tag.id)),
    }));
    if (categories.hasUncategorized) {
      tagSections.push({
        key: "uncategorized" as CategoryFilter,
        label: T[link.lang].uncategorized,
        items: link.items.filter((i) => i.tags.length === 0),
      });
    }
    return tagSections;
  }, [link, categories]);

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
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
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
      };
      if (item.unit_2) base.count_unit_2 = toNum(c?.u2);
      if (item.unit_3) base.count_unit_3 = toNum(c?.u3);
      return base;
    });
  }, [link, counts]);

  // The form's submit button only opens a confirmation dialog — the actual
  // network submit happens on confirm, since a link is single-use.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    setConfirmOpen(false);
    try {
      await submit(payload);
    } catch {
      // submitError is rendered inline.
    }
  };

  /** One item card — shared between the flat (no-category) list and every category section. */
  const renderItemCard = (item: PublicLinkItem) => {
    const entered = itemEntered(item.id);
    const details = item.details?.trim() || null;
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
                aria-label={`View image for ${item.name}`}
              >
                <img
                  src={item.image}
                  alt={item.name}
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

          {/* Item name, ID, details */}
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{item.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.ultimatrix_id}</p>
            {details && (
              <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                {details}
              </p>
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
          {item.unit_2 && (
            <UnitField
              id={`u2-${item.id}`}
              label={item.unit_2.name ?? "Unit 2"}
              value={counts[item.id]?.u2 ?? ""}
              onChange={(v) => setCount(item.id, "u2", v)}
            />
          )}
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
    const lang = link?.lang ?? "en";
    const t = T[lang];
    return (
      <div dir={lang === "ar" ? "rtl" : undefined}>
        <CenteredMessage
          icon={<PackageCheck className="h-12 w-12 text-green-600" />}
          title={t.countSubmitted}
        >
          {t.thankYouPrefix}
          <span className="font-medium text-foreground">{result.reference}</span>
          {t.thankYouSuffix}
        </CenteredMessage>
      </div>
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
            {T[link.lang].inventoryCount}
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
              {T[link.lang].itemsEntered(enteredCount, total)}
            </p>
          </div>
        )}
      </header>

      {/* Category filter — a dropdown that picks which section(s) below are
          visible; sections are never unmounted, so typed counts survive
          switching the filter. */}
      {sections.length > 0 && (
        <div
          className="shrink-0 border-b bg-background/95 px-4 py-2.5"
          dir={link.lang === "ar" ? "rtl" : undefined}
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {T[link.lang].filterByCategory}
          </p>
          <Select
            value={String(activeCategory)}
            onValueChange={(v) =>
              setActiveCategory(v === "all" || v === "uncategorized" ? v : Number(v))
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{T[link.lang].allCategories}</SelectItem>
              {categories.tags.map((tag) => (
                <SelectItem key={tag.id} value={String(tag.id)}>
                  {tag.name}
                </SelectItem>
              ))}
              {categories.hasUncategorized && (
                <SelectItem value="uncategorized">{T[link.lang].uncategorized}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

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
              {T[link.lang].noItems}
            </p>
          ) : (
            <div dir={link.lang === "ar" ? "rtl" : undefined} className="space-y-5">
              {sections.length > 0 ? (
                sections.map((section) => {
                  const visible = activeCategory === "all" || activeCategory === section.key;
                  return (
                    <div
                      key={String(section.key)}
                      className={cn("space-y-3", !visible && "hidden")}
                    >
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.label}
                        <span className="ms-1.5 text-muted-foreground/60">
                          ({section.items.length})
                        </span>
                      </h2>
                      {section.items.map((item) => renderItemCard(item))}
                    </div>
                  );
                })
              ) : (
                <div className="space-y-3">{link.items.map((item) => renderItemCard(item))}</div>
              )}
            </div>
          )}
        </div>

        {/* Pinned submit footer */}
        {total > 0 && (
          <div className="shrink-0 border-t bg-background/90 px-4 py-3">
            <p className="mb-2 text-center text-xs text-muted-foreground">
              {T[link.lang].itemsEntered(enteredCount, total)}
            </p>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              size="lg"
            >
              {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {T[link.lang].submitBtn}
            </Button>
          </div>
        )}
      </form>

      {/* Image lightbox */}
      {lightboxItem?.image && (
        <ImageLightbox
          src={lightboxItem.image}
          alt={lightboxItem.name}
          open={lightboxItem !== null}
          onOpenChange={(o) => !o && setLightboxItem(null)}
        />
      )}

      {/* Submit confirmation — the link is single-use, so make the user confirm. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir={link.lang === "ar" ? "rtl" : undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>{T[link.lang].confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {T[link.lang].confirmDescription(enteredCount, total)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              {T[link.lang].reviewAgain}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {T[link.lang].submitBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
