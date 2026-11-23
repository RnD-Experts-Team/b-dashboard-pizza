"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { AlertTriangle, Film, ImagePlus, Images, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  useAnnouncementUpload,
  type UploadWarning,
} from "@/lib/hooks/use-announcement-upload";
import {
  IMAGE_MAX_BYTES,
  MEDIA_ACCEPT,
  formatBytes,
  formatDuration,
} from "@/lib/announcements/media";
import type { AnnouncementMediaType, GifResult } from "@/types/announcement.types";
import { AnnouncementMedia } from "../display/announcement-media";
import { ExpressionPanel } from "../pickers/expression-panel";
import { AnnouncementErrorAlert } from "../shared/announcement-error-alert";

/**
 * The announcement's media as the form holds it. Send `media_path` (and, for a
 * video, the three video fields) when saving; `media_url` is only the preview,
 * the server never accepts it back.
 */
export interface MediaFieldValue {
  media_path: string;
  media_type: AnnouncementMediaType;
  media_url: string | null;
  media_width: number | null;
  media_height: number | null;
  media_duration_seconds: number | null;
}

export interface MediaFieldProps {
  value: MediaFieldValue | null;
  onChange: (value: MediaFieldValue | null) => void;
  /** True while a file is validating, uploading or cancelling: disable the form's submit. */
  onBusyChange?: (busy: boolean) => void;
  /** The backend's message for `media_path` / `media_type` (a 422 on save), shown inline. */
  error?: string | null;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Pick, preview, replace or remove an announcement's media.
 *
 * Three ways in: drop or browse a file (image / GIF by type, video by type),
 * or "Choose GIF" for a Giphy GIF. A file goes through
 * `use-announcement-upload`: checked in the browser first, then sent (an image
 * in one request, a video in chunks), with a percentage and MB, Cancel, the
 * server's own error with Retry, and a warning (never a block) when the browser
 * cannot read a video's size.
 */
export function MediaField({
  value,
  onChange,
  onBusyChange,
  error,
  disabled = false,
  id,
  className,
}: MediaFieldProps) {
  const t = useTranslations("announcements.mediaField");
  const tWarnings = useTranslations("announcements.warnings");
  const upload = useAnnouncementUpload();

  const inputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [warning, setWarning] = useState<UploadWarning | null>(null);

  const busy = upload.isBusy;

  // Tell the form while an upload runs (and that it stopped if we go away mid-way).
  const onBusyRef = useRef(onBusyChange);
  useEffect(() => {
    onBusyRef.current = onBusyChange;
  }, [onBusyChange]);
  useEffect(() => {
    onBusyRef.current?.(busy);
  }, [busy]);
  useEffect(() => () => onBusyRef.current?.(false), []);

  // The hook clears its warning when the upload finishes; keep it beside the preview.
  useEffect(() => {
    if (upload.warning) setWarning(upload.warning);
  }, [upload.warning]);

  const startUpload = async (file: File) => {
    lastFileRef.current = file;
    setWarning(null);
    const result = await upload.start(file);
    if (!result) return;
    onChange({
      media_path: result.media_path,
      media_type: result.media_type,
      media_url: result.media_url,
      media_width: result.width,
      media_height: result.height,
      media_duration_seconds: result.duration_seconds,
    });
    upload.reset();
  };

  const pickGif = (gif: GifResult) => {
    setWarning(null);
    onChange({
      media_path: gif.url,
      media_type: "gif",
      media_url: gif.url,
      media_width: null,
      media_height: null,
      media_duration_seconds: null,
    });
  };

  const remove = () => {
    setWarning(null);
    onChange(null);
  };

  const canInteract = !disabled && !busy;
  const browse = () => {
    if (canInteract) inputRef.current?.click();
  };

  /* ── Drag and drop ─────────────────────────────────────────────────────── */
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");
  const dragProps = {
    onDragEnter: (event: DragEvent) => {
      if (!canInteract || !hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (event: DragEvent) => {
      if (!canInteract || !hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (event: DragEvent) => {
      if (!canInteract) return;
      event.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (event: DragEvent) => {
      if (!canInteract) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void startUpload(file);
    },
  };

  const gifButton = (label: string) => (
    <ExpressionPanel
      onGifSelect={pickGif}
      side="top"
      align="start"
      trigger={
        <Button type="button" variant="outline" size="sm" disabled={!canInteract} className="gap-1.5">
          <Images aria-hidden />
          {label}
        </Button>
      }
    />
  );

  const percent = Math.round(upload.progress.percent);
  const cancelling = upload.state === "cancelling";
  const speed = upload.progress.bytesPerSecond;

  return (
    <div id={id} data-slot="media-field" className={cn("space-y-2.5", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void startUpload(file);
        }}
      />

      {/* Uploading */}
      {busy && (
        <div role="status" aria-live="polite" className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <UploadCloud className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{lastFileRef.current?.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("progress", {
                  percent,
                  loaded: formatBytes(upload.progress.loaded),
                  total: formatBytes(upload.progress.total),
                })}
                {speed ? ` · ${t("speed", { speed: formatBytes(speed) })}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={() => void upload.cancel()}
            >
              {cancelling ? t("cancelling") : t("cancel")}
            </Button>
          </div>
          <Progress value={percent} aria-label={t("uploading")} className="h-1.5" />
        </div>
      )}

      {/* An upload that failed: the server's own words, with Retry */}
      {!busy && upload.error && (
        <AnnouncementErrorAlert
          error={upload.error}
          title={t("uploadFailed")}
          onRetry={lastFileRef.current ? () => void startUpload(lastFileRef.current as File) : undefined}
          onDismiss={upload.reset}
          compact
        />
      )}

      {/* The video's size/length could not be read: a warning, never a block */}
      {!busy && warning && (
        <p
          role="status"
          className="flex items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{tWarnings(warning.code)}</span>
        </p>
      )}

      {/* Current media */}
      {!busy && value && (
        <div className="space-y-2">
          <AnnouncementMedia
            src={value.media_url}
            type={value.media_type}
            width={value.media_width}
            height={value.media_height}
            durationSeconds={value.media_duration_seconds}
            variant="field"
          />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {value.media_type === "video" ? (
                <Film className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <ImagePlus className="size-3.5 shrink-0" aria-hidden />
              )}
              <span className="truncate">
                {[
                  t(`kinds.${value.media_type}`),
                  value.media_type === "video" && value.media_duration_seconds
                    ? formatDuration(value.media_duration_seconds)
                    : null,
                  value.media_type === "video" && value.media_width && value.media_height
                    ? `${value.media_width}×${value.media_height}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <div className="ms-auto flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canInteract}
                onClick={browse}
                className="gap-1.5"
              >
                <RefreshCw aria-hidden />
                {t("replace")}
              </Button>
              {gifButton(t("chooseGif"))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={remove}
                className="gap-1.5 text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
              >
                <Trash2 aria-hidden />
                {t("remove")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Nothing yet: the drop zone */}
      {!busy && !value && (
        <div className="space-y-2">
          <div
            role="button"
            tabIndex={canInteract ? 0 : -1}
            aria-disabled={!canInteract}
            aria-label={t("dropAria")}
            onClick={browse}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                browse();
              }
            }}
            {...dragProps}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors outline-none",
              "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              dragging && "border-ring bg-muted/60",
              error && "border-destructive",
              !canInteract && "pointer-events-none opacity-60",
            )}
          >
            <UploadCloud className="size-7 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">{dragging ? t("dropHere") : t("dropTitle")}</p>
            <p className="text-xs text-balance text-muted-foreground">
              {t("hint", { size: formatBytes(IMAGE_MAX_BYTES) })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {gifButton(t("chooseGif"))}
            <span className="text-xs text-muted-foreground">{t("gifHint")}</span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
