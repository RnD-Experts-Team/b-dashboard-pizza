"use client";

import { Camera, CameraOff, Crop, ImageOff, Loader2, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/toolbox-tickets/uploads";
import type { ReportShot } from "@/lib/store/report-problem.store";

interface ScreenshotCardProps {
  shot: ReportShot | null;
  /** The server refused the image (`notes.0.files.0`). */
  error: string | null;
  disabled?: boolean;
  onRetake: () => void;
  onRemove: () => void;
  onRestore: () => void;
}

/**
 * The picked part's screenshot: capturing → preview (with Retake / Remove),
 * removed (with "add it back"), or failed (sending still works).
 */
export function ScreenshotCard({ shot, error, disabled, onRetake, onRemove, onRestore }: ScreenshotCardProps) {
  const t = useTranslations("reportProblem.screenshot");

  const retake = (
    <Button type="button" size="sm" variant="outline" className="h-7" disabled={disabled} onClick={onRetake}>
      <RotateCcw className="me-1 h-3.5 w-3.5" />
      {t("retake")}
    </Button>
  );

  return (
    <div className="space-y-2 rounded-lg border p-3" data-slot="report-screenshot">
      <div className="flex items-center gap-2">
        <Camera className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="flex-1 text-xs font-medium">{t("title")}</p>
        {shot?.status === "ready" && !shot.removed && shot.result?.partial && (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Crop className="h-3 w-3" />
            {t("partial")}
          </Badge>
        )}
      </div>

      {!shot || shot.status === "capturing" ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-md bg-muted/40 text-xs text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("capturing")}
        </div>
      ) : shot.status === "failed" ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <ImageOff className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{t(shot.error === "timeout" ? "failedTimeout" : "failed")}</p>
          </div>
          <div className="flex justify-end">{retake}</div>
        </div>
      ) : shot.removed ? (
        <div className="space-y-2">
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed py-6 text-xs text-muted-foreground">
            <CameraOff className="h-5 w-5" />
            {t("removed")}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" className="h-7" disabled={disabled} onClick={onRestore}>
              <Undo2 className="me-1 h-3.5 w-3.5" />
              {t("restore")}
            </Button>
            {retake}
          </div>
        </div>
      ) : shot.result ? (
        <div className="space-y-2">
          <a
            href={shot.result.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-md border bg-muted/40"
            title={t("open")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shot.result.previewUrl}
              alt={t("alt")}
              className="mx-auto max-h-60 w-full object-contain"
            />
          </a>
          <div className="flex flex-wrap items-center gap-2">
            <span dir="ltr" className="text-[11px] text-muted-foreground tabular-nums">
              {shot.result.width}×{shot.result.height} · {formatBytes(shot.result.file.size)}
            </span>
            <span className="ms-auto flex gap-2">
              {retake}
              <Button type="button" size="sm" variant="ghost" className="h-7" disabled={disabled} onClick={onRemove}>
                <Trash2 className="me-1 h-3.5 w-3.5" />
                {t("remove")}
              </Button>
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("privacy")}</p>
        </div>
      ) : null}

      {error && (
        <div className="space-y-1.5 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          <p>{t("refused", { message: error })}</p>
          {shot?.status === "ready" && !shot.removed && (
            <Button type="button" size="sm" variant="outline" className="h-7" disabled={disabled} onClick={onRemove}>
              {t("sendWithout")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
