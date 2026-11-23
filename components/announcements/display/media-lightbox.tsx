"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface MediaLightboxProps {
  src: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Full-size image / GIF viewer. Copied from `ImageLightbox` in
 * `components/cleaning/cleaning-ui.tsx` (built on the real Dialog so it stacks
 * correctly over another dialog, such as the announcement popup), with the
 * screen-size caps in `dvh` and a translated close label.
 */
export function MediaLightbox({ src, alt, open, onOpenChange }: MediaLightboxProps) {
  const t = useTranslations("announcements.display");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="w-fit max-w-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogClose className="absolute -top-11 end-0 rounded-full bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-hidden">
          <X className="h-5 w-5" aria-hidden />
          <span className="sr-only">{t("close")}</span>
        </DialogClose>
        {/* The URL is already a validated http(s) media url (safeMediaUrl). */}
        <img
          src={src}
          alt={alt}
          className="max-h-[85dvh] max-w-[calc(100vw-2rem)] rounded-2xl object-contain shadow-2xl"
        />
      </DialogContent>
    </Dialog>
  );
}
