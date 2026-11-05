"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** A dashed box with a message and an optional Retry, for a list, page or panel that failed to load. */
export function ErrorState({ message, onRetry, compact }: { message: string; onRetry?: () => void; compact?: boolean }) {
  const t = useTranslations("reportBuilder.actions");
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center",
        compact ? "py-6" : "py-24",
      )}
    >
      <AlertTriangle className="h-8 w-8 text-muted-foreground/60" />
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="me-1.5 h-3.5 w-3.5" />
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
