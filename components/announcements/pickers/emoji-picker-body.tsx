"use client";

import { useEffect } from "react";
import { EmojiPicker, defaultEmojiDataResolver, type EmojiDataResolver } from "frimousse";
import { Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * The frimousse picker, styled with the shadcn tokens. frimousse is unstyled:
 * it ships only a few sizing / overflow defaults and exposes `frimousse-*`
 * attributes and a `components` prop, so every colour here is a semantic token.
 *
 * THIS FILE IS LOADED LAZILY (see `emoji-picker.tsx`): frimousse stays out of
 * every dashboard route's bundle until someone opens a picker.
 */

/* ────────────────────────────────────────────────────────────────────────── */
/*  Data loading                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

type LoadErrorListener = (error: unknown) => void;
const loadErrorListeners = new Set<LoadErrorListener>();

/**
 * frimousse swallows a failed data load (it logs it and keeps showing
 * "loading" forever), so a missing or blocked file would look like a stuck
 * spinner. Delegating to the default resolver through this wrapper (which keeps
 * Emojibase's own unsupported-emoji filtering) lets the picker tell the user
 * and offer a retry. The data is the vendored copy in `public/emojibase/`.
 */
const resolveEmojiData: EmojiDataResolver = async (locale, options) => {
  try {
    return await defaultEmojiDataResolver(locale, options);
  } catch (error) {
    if (!options.signal?.aborted) {
      loadErrorListeners.forEach((listener) => listener(error));
    }
    throw error;
  }
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface EmojiPickerBodyProps {
  onSelect: (emoji: string) => void;
  /** The emoji data could not be loaded (file missing, blocked, offline). */
  onLoadError: () => void;
  /** Focus the search box on mount (desktop only: it would raise a phone keyboard). */
  autoFocusSearch?: boolean;
  className?: string;
}

export function EmojiPickerBody({
  onSelect,
  onLoadError,
  autoFocusSearch = false,
  className,
}: EmojiPickerBodyProps) {
  const t = useTranslations("announcements.pickers.emoji");

  useEffect(() => {
    loadErrorListeners.add(onLoadError);
    return () => {
      loadErrorListeners.delete(onLoadError);
    };
  }, [onLoadError]);

  return (
    <EmojiPicker.Root
      locale="en"
      emojibaseUrl="/emojibase"
      resolveEmojiData={resolveEmojiData}
      columns={9}
      onEmojiSelect={({ emoji }) => onSelect(emoji)}
      className={cn("isolate mx-auto flex h-full w-full min-w-0 max-w-88 flex-col", className)}
    >
      <div className="flex items-center gap-1.5 p-2 pb-1">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <EmojiPicker.Search
            autoFocus={autoFocusSearch}
            aria-label={t("search")}
            placeholder={t("search")}
            className="h-8 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent ps-8 pe-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>

        <EmojiPicker.SkinTone emoji="👋">
          {({ skinTone, setSkinTone, skinToneVariations }) => {
            if (skinToneVariations.length === 0) return null;
            const index = Math.max(
              0,
              skinToneVariations.findIndex((v) => v.skinTone === skinTone),
            );
            const next = skinToneVariations[(index + 1) % skinToneVariations.length];
            return (
              <button
                type="button"
                onClick={() => setSkinTone(next.skinTone)}
                aria-label={t("skinTone")}
                title={t("skinTone")}
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-input text-base transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {skinToneVariations[index].emoji}
              </button>
            );
          }}
        </EmojiPicker.SkinTone>
      </div>

      <EmojiPicker.Viewport className="relative min-h-0 flex-1 outline-hidden">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          {t("loading")}
        </EmojiPicker.Loading>

        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
          {({ search }) => t("empty", { query: search })}
        </EmojiPicker.Empty>

        <EmojiPicker.List
          className="pb-1.5 select-none"
          components={{
            CategoryHeader: ({ category, className: headerClass, ...props }) => (
              <div
                {...props}
                className={cn(
                  "bg-popover px-3 pt-3 pb-1.5 text-xs font-medium text-muted-foreground",
                  headerClass,
                )}
              >
                {category.label}
              </div>
            ),
            Row: ({ children, className: rowClass, ...props }) => (
              <div {...props} className={cn("scroll-my-1.5 px-1.5", rowClass)}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, className: emojiClass, ...props }) => (
              <button
                {...props}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-lg outline-none data-[active]:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60",
                  emojiClass,
                )}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}
