"use client";

import { Suspense, useCallback, useEffect, useState, type ComponentType } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { KitErrorBoundary } from "../shared/error-boundary";
import type { EmojiPickerBodyProps } from "./emoji-picker-body";

export interface EmojiPickerProps {
  /** Called with the emoji character(s). */
  onSelect: (emoji: string) => void;
  /** Focus the search box on mount. Desktop only: on a phone it raises the keyboard. */
  autoFocusSearch?: boolean;
  className?: string;
}

/** What the panel looks like while the picker's code or data is on its way. */
function PickerSkeleton() {
  return (
    <div className="space-y-3 p-2" aria-hidden>
      <div className="flex gap-1.5">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="size-8" />
      </div>
      <div className="grid grid-cols-9 gap-1.5 px-1.5">
        {Array.from({ length: 27 }, (_, i) => (
          <Skeleton key={i} className="size-7 rounded-md" />
        ))}
      </div>
    </div>
  );
}

function PickerError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("announcements.pickers.emoji");
  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center"
    >
      <AlertCircle className="size-6 text-red-600 dark:text-red-400" aria-hidden />
      <p className="text-sm font-medium">{t("loadFailed")}</p>
      <p className="text-xs text-muted-foreground">{t("loadFailedHint")}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry} className="mt-1 gap-1.5">
        <RefreshCw className="size-3.5" aria-hidden />
        {t("retry")}
      </Button>
    </div>
  );
}

/**
 * Loads the picker's code on demand. This is a plain dynamic `import()` in an
 * effect instead of `next/dynamic({ ssr: false })` because next/dynamic wraps
 * `React.lazy`, which caches a REJECTED chunk for good: after one failed load
 * (offline, a deploy replaced the chunk) a retry could never recover.
 */
function EmojiPickerLoader({
  onSelect,
  autoFocusSearch,
  onRetry,
}: Omit<EmojiPickerProps, "className"> & { onRetry: () => void }) {
  const [Body, setBody] = useState<ComponentType<EmojiPickerBodyProps> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    import("./emoji-picker-body").then(
      (module) => {
        if (alive) setBody(() => module.EmojiPickerBody);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const handleLoadError = useCallback(() => setFailed(true), []);

  if (failed) return <PickerError onRetry={onRetry} />;
  if (!Body) return <PickerSkeleton />;

  return (
    <Suspense fallback={<PickerSkeleton />}>
      <Body
        onSelect={onSelect}
        onLoadError={handleLoadError}
        autoFocusSearch={autoFocusSearch}
      />
    </Suspense>
  );
}

/**
 * The emoji picker (frimousse): searchable, skin tones, keyboard navigable,
 * virtualised. Client-only and code-split. A failed load of the code OR of the
 * emoji data shows a retry tile instead of a spinner that never ends.
 *
 * It fills its parent (`h-full`), so give it a fixed-height container: the
 * `ExpressionPanel` does.
 */
export function EmojiPicker({ onSelect, autoFocusSearch, className }: EmojiPickerProps) {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <div data-slot="emoji-picker" className={cn("h-full min-h-0 w-full", className)}>
      <KitErrorBoundary key={attempt} fallback={() => <PickerError onRetry={retry} />}>
        <EmojiPickerLoader
          onSelect={onSelect}
          autoFocusSearch={autoFocusSearch}
          onRetry={retry}
        />
      </KitErrorBoundary>
    </div>
  );
}
