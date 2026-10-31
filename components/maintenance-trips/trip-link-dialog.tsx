"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
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

const COPIED_RESET_MS = 2000;

/** True where the browser can hand the link to WhatsApp / SMS. */
export function canShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** Copy and Share for one trip link (the plain token is only ever known right after it is issued). */
export function useTripLinkActions(url: string, shareText: string) {
  const t = useTranslations("maintenanceSystem");
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("common.copied"));
      window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      toast.error(t("trips.copyFailed"));
    }
  }

  async function share(): Promise<void> {
    if (!canShare()) {
      await copy();
      return;
    }
    try {
      await navigator.share({ text: shareText });
    } catch (err) {
      // The person closing the share sheet is not an error.
      if (err instanceof DOMException && err.name === "AbortError") return;
      await copy();
    }
  }

  return { copied, copy, share };
}

/** The link, Copy, Share — the same row in the dialog and in the drawer. */
export function TripLinkActions({ url, shareText }: { url: string; shareText: string }) {
  const t = useTranslations("maintenanceSystem");
  const { copied, copy, share } = useTripLinkActions(url, shareText);
  return (
    <div className="space-y-2">
      <Input readOnly value={url} aria-label={t("trips.linkLabel")} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t("common.copied") : t("common.copy")}
        </Button>
        <Button type="button" size="sm" onClick={() => void share()}>
          <Share2 aria-hidden="true" />
          {t("common.share")}
        </Button>
      </div>
    </div>
  );
}

/**
 * "Trip link" — shown once, right after a link is issued (new trip, New link,
 * or a booking that made a trip). Reusable by the ticket page's booking flow.
 */
export function TripLinkDialog({
  open,
  onOpenChange,
  url,
  shareText,
  technicianName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  shareText: string;
  technicianName?: string | null;
}) {
  const t = useTranslations("maintenanceSystem");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading font-semibold">{t("trips.linkDialogTitle")}</DialogTitle>
          <DialogDescription>
            {technicianName
              ? t("trips.linkDialogBodyFor", { name: technicianName })
              : t("trips.linkDialogBody")}
          </DialogDescription>
        </DialogHeader>
        <TripLinkActions url={url} shareText={shareText} />
        <p className="text-xs text-muted-foreground">{t("trips.linkShownOnce")}</p>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
