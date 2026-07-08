"use client";

/* eslint-disable @next/next/no-img-element -- images are served via the
   same-origin /inventory-storage proxy; next/image remote config is unnecessary. */

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, ImageOff, Store, ZoomIn } from "lucide-react";

import { useItemDetail } from "@/lib/hooks/use-inventory-items";

/**
 * Full-screen image lightbox — built on the real Dialog primitive (not a
 * hand-rolled overlay) so it nests correctly inside the Sheet's own dismissable
 * layer stack. A plain fixed <div> sibling gets its outside-clicks swallowed
 * by the Sheet's own dismiss handling; Radix's own nested-layer awareness only
 * kicks in when the popup is itself a Dialog/Sheet primitive.
 */
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

/** One label + value cell, used inside the grid rows of the info panel. */
function InfoCell({
  label,
  value,
  dir,
}: {
  label: string;
  value?: string | null;
  dir?: "rtl" | "ltr";
}) {
  return (
    <div className="p-3.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        dir={dir}
        className="mt-0.5 truncate text-sm font-semibold"
        title={value ?? undefined}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function ItemDetailSkeleton() {
  return (
    <div className="space-y-4 p-6 pt-4">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

interface ItemDetailSheetProps {
  itemId: number | null;
  /** Ambient dashboard store, forwarded as X-Store-Id — see `useItemDetail`. */
  storeId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItemDetailSheet({
  itemId,
  storeId,
  open,
  onOpenChange,
}: ItemDetailSheetProps) {
  const { item, isLoading, error } = useItemDetail(open ? itemId : null, storeId);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setLightboxOpen(false);
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>{item ? item.name_en : "Item"}</SheetTitle>
          <SheetDescription>
            {item ? item.ultimatrix_id : "Catalog item detail."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {isLoading ? (
            <ItemDetailSkeleton />
          ) : error ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : item ? (
            <div className="space-y-4 p-6">
              {/* ── Unified info panel ── */}
              <Card className="overflow-hidden">
                {/* Top: thumbnail + name/id + types + availability */}
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    {item.image ? (
                      <button
                        type="button"
                        className="group relative shrink-0 overflow-hidden rounded-xl border"
                        onClick={() => setLightboxOpen(true)}
                        aria-label={`View image for ${item.name_en}`}
                      >
                        <img
                          src={item.image}
                          alt={item.name_en}
                          className="h-14 w-14 object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/40 py-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                          <ZoomIn className="h-3 w-3 text-white" />
                        </div>
                      </button>
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold leading-tight">
                        {item.name_en}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.ultimatrix_id}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.types.map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className="capitalize text-[10px]"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className="flex shrink-0 items-center gap-1.5 px-3 py-1 text-xs"
                  >
                    <Store className="h-3 w-3" />
                    {item.all_stores
                      ? "All stores"
                      : `${item.stores?.length ?? 0} store${
                          item.stores?.length === 1 ? "" : "s"
                        }`}
                  </Badge>
                </div>

                {/* Unit conversions strip */}
                <div className="grid grid-cols-3 divide-x border-t">
                  <InfoCell label="Unit 1" value={item.unit_1?.name} />
                  <InfoCell label="Unit 2" value={item.unit_2?.name} />
                  <InfoCell label="Unit 3" value={item.unit_3?.name} />
                </div>
                {(item.unit_2_per_unit_1 || item.unit_3_per_unit_2) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
                    {item.unit_2_per_unit_1 && (
                      <span>
                        1 {item.unit_1?.name} ={" "}
                        <span className="font-medium text-foreground">
                          {Number(item.unit_2_per_unit_1)}
                        </span>{" "}
                        {item.unit_2?.name}
                      </span>
                    )}
                    {item.unit_3 && item.unit_3_per_unit_2 && (
                      <span>
                        1 {item.unit_2?.name} ={" "}
                        <span className="font-medium text-foreground">
                          {Number(item.unit_3_per_unit_2)}
                        </span>{" "}
                        {item.unit_3.name}
                      </span>
                    )}
                  </div>
                )}

                {/* Names — one row, three languages */}
                <div className="grid grid-cols-3 divide-x border-t">
                  <InfoCell label="Name (EN)" value={item.name_en} />
                  <InfoCell label="Name (AR)" value={item.name_ar} dir="rtl" />
                  <InfoCell label="Name (ES)" value={item.name_es} />
                </div>

                {/* Details — one row, three languages (only if any present) */}
                {(item.details_en || item.details_ar || item.details_es) && (
                  <div className="grid grid-cols-3 divide-x border-t">
                    <InfoCell label="Details (EN)" value={item.details_en} />
                    <InfoCell
                      label="Details (AR)"
                      value={item.details_ar}
                      dir="rtl"
                    />
                    <InfoCell label="Details (ES)" value={item.details_es} />
                  </div>
                )}
              </Card>

              {/* Store availability list */}
              {!item.all_stores && item.stores && item.stores.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
                    <Store className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      Available in {item.stores.length} store
                      {item.stores.length === 1 ? "" : "s"}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2 p-4">
                    {item.stores.map((s) => (
                      <Badge
                        key={s.id}
                        variant="outline"
                        className="gap-1.5 py-1.5 text-xs font-normal"
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">
                          {s.store_number}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          ) : null}
        </ScrollArea>
      </SheetContent>

      {item?.image && (
        <ImageLightbox
          src={item.image}
          alt={item.name_en}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}
    </Sheet>
  );
}
