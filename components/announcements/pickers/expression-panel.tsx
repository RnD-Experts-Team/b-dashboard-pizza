"use client";

import { useState, type ReactNode } from "react";
import { Film, Smile } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { GifResult } from "@/types/announcement.types";
import { scrollInDialog } from "../shared/scroll-in-dialog";
import { useMediaQuery } from "../shared/use-media-query";
import { EmojiPicker } from "./emoji-picker";
import { GifPicker } from "./gif-picker";

export type ExpressionTab = "emoji" | "gif";

export interface ExpressionPanelProps {
  /**
   * The button that opens the panel: ONE element that accepts a ref and props
   * (a `Button`, or a component that spreads its props onto one).
   */
  trigger: ReactNode;
  /** Give a handler to get that tab. With both, the panel is the tabbed Emoji | GIF one. */
  onEmojiSelect?: (emoji: string) => void;
  onGifSelect?: (gif: GifResult) => void;
  defaultTab?: ExpressionTab;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Close after an emoji (a one-off insert) or stay open for several (a chat). Default stay open. */
  closeOnEmoji?: boolean;
  /** Close after a GIF. Default true. */
  closeOnGif?: boolean;
  /** Where the popover opens (md+ only; the phone sheet always rises from the bottom). */
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * The WhatsApp-style expression panel: an Emoji | GIF picker that is a Popover
 * from md up and a bottom Sheet on phones.
 *
 *  - Inside a Dialog the popover is portaled outside it, so it carries the
 *    wheel/touch fix (`scrollInDialog`) and is height-capped to
 *    `min(24rem, 60dvh)` with collision padding.
 *  - It never moves focus into the text field it feeds: the caller inserts at
 *    the caret itself, and focus leaving a popover would close it.
 */
export function ExpressionPanel({
  trigger,
  onEmojiSelect,
  onGifSelect,
  defaultTab,
  open: openProp,
  onOpenChange,
  closeOnEmoji = false,
  closeOnGif = true,
  side = "top",
  align = "end",
  className,
}: ExpressionPanelProps) {
  const t = useTranslations("announcements.pickers");
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const hasEmoji = !!onEmojiSelect;
  const hasGif = !!onGifSelect;
  const startTab: ExpressionTab = defaultTab ?? (hasEmoji ? "emoji" : "gif");

  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };

  const [tab, setTab] = useState<ExpressionTab>(startTab);
  // A tab's picker mounts the first time it is shown (the GIF tab fetches), then stays.
  const [visited, setVisited] = useState<ReadonlySet<ExpressionTab>>(new Set([startTab]));
  const show = (next: ExpressionTab) => {
    setTab(next);
    setVisited((current) => (current.has(next) ? current : new Set(current).add(next)));
  };

  const pickEmoji = (emoji: string) => {
    onEmojiSelect?.(emoji);
    if (closeOnEmoji) setOpen(false);
  };
  const pickGif = (gif: GifResult) => {
    onGifSelect?.(gif);
    if (closeOnGif) setOpen(false);
  };

  const emojiPicker = <EmojiPicker onSelect={pickEmoji} autoFocusSearch={isDesktop} />;
  const gifPicker = <GifPicker onSelect={pickGif} autoFocusSearch={isDesktop} />;

  const body =
    hasEmoji && hasGif ? (
      <Tabs
        value={tab}
        onValueChange={(value) => show(value as ExpressionTab)}
        className="min-h-0 flex-1 gap-0"
      >
        <TabsList className="mx-2 mt-2 grid h-8 w-auto shrink-0 grid-cols-2">
          <TabsTrigger value="emoji" className="gap-1.5 text-xs">
            <Smile className="size-3.5" aria-hidden />
            {t("tabs.emoji")}
          </TabsTrigger>
          <TabsTrigger value="gif" className="gap-1.5 text-xs">
            <Film className="size-3.5" aria-hidden />
            {t("tabs.gif")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="emoji" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
          {visited.has("emoji") && emojiPicker}
        </TabsContent>
        <TabsContent value="gif" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
          {visited.has("gif") && gifPicker}
        </TabsContent>
      </Tabs>
    ) : hasEmoji ? (
      <div className="min-h-0 flex-1">{emojiPicker}</div>
    ) : (
      <div className="min-h-0 flex-1">{gifPicker}</div>
    );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          {...scrollInDialog}
          aria-label={t("panelTitle")}
          className={cn(
            "flex h-[min(24rem,60dvh)] max-h-(--radix-popover-content-available-height) w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden p-0",
            className,
          )}
        >
          {body}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "h-[min(28rem,72dvh)] gap-0 rounded-t-2xl bg-popover p-0",
          className,
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("panelTitle")}</SheetTitle>
          <SheetDescription>{t("panelDescription")}</SheetDescription>
        </SheetHeader>
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
        {body}
      </SheetContent>
    </Sheet>
  );
}
