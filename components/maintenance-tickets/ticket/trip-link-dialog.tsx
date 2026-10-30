"use client";

import { useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { tripLinkUrl, tripShareText } from "@/lib/maintenance-trips";
import type { TripLinkIssued } from "@/types/maintenance-v2";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The technician's NEW trip link, shown once after booking an inspection or
 * the work (the plain token is never sent again). Copy, or Share through
 * the Web Share API (WhatsApp / SMS on a phone), falling back to copying the
 * message.
 */
export function TripLinkDialog({
  link,
  plannedDate,
  storeNumber,
  onClose,
}: {
  link: TripLinkIssued | null;
  plannedDate: string | null;
  storeNumber: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const url = link ? tripLinkUrl(link.urlToken, locale) : "";
  const message = link
    ? tripShareText({
        link: url,
        plannedDate: plannedDate ?? "",
        storeNumbers: storeNumber ? [storeNumber] : [],
        locale,
        template: t.has("trips.shareText") ? String(t.raw("trips.shareText")) : undefined,
      })
    : "";

  async function onCopy() {
    const ok = await copyText(url);
    if (!ok) return toast.error(t("tickets.tripLink.copyFailed"));
    setCopied(true);
    toast.success(t("common.copied"));
  }

  async function onShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: message });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    const ok = await copyText(message);
    if (ok) toast.success(t("tickets.tripLink.messageCopied"));
    else toast.error(t("tickets.tripLink.copyFailed"));
  }

  return (
    <Dialog
      open={link !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent className="w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading font-semibold">
            <Link2 className="h-4 w-4" aria-hidden="true" />
            {t("workflow.tripLinkTitle")}
          </DialogTitle>
          <DialogDescription>{t("workflow.tripLinkBody")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input readOnly value={url} aria-label={t("workflow.tripLinkTitle")} onFocus={(e) => e.currentTarget.select()} />
          {link ? (
            <p className="text-xs text-muted-foreground">{t("tickets.tripLink.expires", { hours: link.expiresAfterHours })}</p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => void onCopy()}>
            {copied ? <Check className="me-1.5 h-4 w-4" aria-hidden="true" /> : <Copy className="me-1.5 h-4 w-4" aria-hidden="true" />}
            {copied ? t("common.copied") : t("common.copy")}
          </Button>
          <Button type="button" onClick={() => void onShare()}>
            <Share2 className="me-1.5 h-4 w-4" aria-hidden="true" />
            {t("common.share")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
