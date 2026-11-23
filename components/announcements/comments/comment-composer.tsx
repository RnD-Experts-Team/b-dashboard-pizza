"use client";

import { useLayoutEffect, useRef, useState, type ClipboardEvent } from "react";
import { ImagePlus, Loader2, Send, Smile, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useAnnouncementUpload } from "@/lib/hooks/use-announcement-upload";
import { fieldError } from "@/lib/announcements/errors";
import {
  IMAGE_ACCEPT,
  classifyFile,
  formatBytes,
  safeMediaUrl,
} from "@/lib/announcements/media";
import { useAnnouncementCommentsStore } from "@/lib/store/announcement-comments.store";
import type { CommentMediaType, GifResult } from "@/types/announcement.types";
import { AnnouncementErrorAlert } from "../shared/announcement-error-alert";
import { ExpressionPanel } from "../pickers/expression-panel";

/** The contract documents no limit for a comment; this keeps one reasonable. */
export const COMMENT_MAX_LENGTH = 2000;
const COUNTER_FROM = 1500;
const TEXTAREA_MAX_PX = 160;

interface Attachment {
  /** From the upload, or a picked GIF's absolute url. */
  media_path: string;
  media_type: CommentMediaType;
  preview: string;
  name: string;
}

export interface CommentComposerProps {
  announcementId: number;
  /** After a comment was posted (the thread scrolls to it, say). */
  onPosted?: () => void;
  autoFocus?: boolean;
  className?: string;
}

function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Write a comment: text, an emoji from the Emoji | GIF panel, a picked GIF or an
 * uploaded image. Enter sends (Shift+Enter adds a line; on a touch screen Enter
 * adds a line and the Send button sends, as the on-screen keyboard has no
 * Shift). The draft survives a failed send, and the backend's own message
 * shows under the field it is about.
 *
 * Comments never carry video: a video file is refused here with a message.
 */
export function CommentComposer({
  announcementId,
  onPosted,
  autoFocus = false,
  className,
}: CommentComposerProps) {
  const t = useTranslations("announcements.comments");
  const me = useAuthStore((s) => s.user);

  const post = useAnnouncementCommentsStore((s) => s.post);
  const clearPostError = useAnnouncementCommentsStore((s) => s.clearPostError);
  const posting = useAnnouncementCommentsStore((s) => s.threads[announcementId]?.posting ?? false);
  const postError = useAnnouncementCommentsStore((s) => s.threads[announcementId]?.postError ?? null);

  const upload = useAnnouncementUpload();

  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<{ start: number; end: number } | null>(null);
  const lastFileRef = useRef<File | null>(null);

  const trimmed = text.trim();
  const tooLong = text.length > COMMENT_MAX_LENGTH;
  const busy = posting || upload.isBusy;
  const canSend = !busy && !tooLong && (trimmed.length > 0 || attachment !== null);

  // Grow with the text, up to a cap, then scroll.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_PX)}px`;
  }, [text]);

  const rememberCaret = () => {
    const el = textareaRef.current;
    if (el) caretRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const touchEdit = () => {
    if (postError) clearPostError(announcementId);
    if (notice) setNotice(null);
  };

  /** Insert at the remembered caret WITHOUT focusing: focus leaving the panel would close it. */
  const insertEmoji = (emoji: string) => {
    touchEdit();
    const caret = caretRef.current ?? { start: text.length, end: text.length };
    const next = text.slice(0, caret.start) + emoji + text.slice(caret.end);
    const position = caret.start + emoji.length;
    setText(next);
    caretRef.current = { start: position, end: position };
    requestAnimationFrame(() => textareaRef.current?.setSelectionRange(position, position));
  };

  const pickGif = (gif: GifResult) => {
    touchEdit();
    void upload.cancel();
    setAttachment({
      media_path: gif.url,
      media_type: "gif",
      preview: gif.preview_url,
      name: "GIF",
    });
  };

  const attachFile = async (file: File) => {
    touchEdit();
    if (classifyFile(file) === "video") {
      setNotice(t("videoNotAllowed"));
      return;
    }
    lastFileRef.current = file;
    const result = await upload.start(file);
    if (result && (result.kind === "image" || result.kind === "gif")) {
      setAttachment({
        media_path: result.media_path,
        media_type: result.kind,
        preview: result.media_url,
        name: file.name,
      });
      upload.reset();
    }
  };

  const send = async () => {
    if (!canSend) return;
    const result = await post(announcementId, {
      ...(trimmed ? { body: trimmed } : {}),
      ...(attachment
        ? { media_path: attachment.media_path, media_type: attachment.media_type }
        : {}),
    });
    if (result.ok) {
      setText("");
      setAttachment(null);
      caretRef.current = null;
      onPosted?.();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const image = Array.from(event.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (image) {
      event.preventDefault();
      void attachFile(image);
    }
  };

  const bodyError = fieldError(postError, "body");
  const mediaError = fieldError(postError, "media_path", "media_type", "media");
  const inlineOnly = postError?.kind === "validation" && !!(bodyError || mediaError);

  const preview = attachment ? safeMediaUrl(attachment.preview) : null;
  const percent = Math.round(upload.progress.percent);

  return (
    <div data-slot="comment-composer" className={cn("flex min-w-0 items-start gap-2.5", className)}>
      <span
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"
        aria-hidden
      >
        {initialsOf(me?.name)}
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        {/* Uploading */}
        {upload.isBusy && (
          <div
            className="space-y-1.5 rounded-lg border bg-muted/40 p-2.5"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <Loader2
                className="size-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-xs">{lastFileRef.current?.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {t("uploadProgress", {
                  percent,
                  loaded: formatBytes(upload.progress.loaded),
                  total: formatBytes(upload.progress.total),
                })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("cancelUpload")}
                disabled={upload.state === "cancelling"}
                onClick={() => void upload.cancel()}
              >
                <X aria-hidden />
              </Button>
            </div>
            <Progress value={percent} aria-label={t("uploading")} className="h-1" />
          </div>
        )}

        {upload.error && (
          <AnnouncementErrorAlert
            error={upload.error}
            compact
            onRetry={lastFileRef.current ? () => void attachFile(lastFileRef.current as File) : undefined}
            onDismiss={upload.reset}
          />
        )}

        {notice && (
          <p role="alert" className="text-xs text-destructive">
            {notice}
          </p>
        )}

        {/* The picked picture or GIF */}
        {attachment && preview && (
          <div className="relative inline-block max-w-full">
            {/* A validated media url; Giphy / the uploads host, not ours to optimise. */}
            <img
              src={preview}
              alt={t("attachmentPreview")}
              className="block h-20 max-w-full rounded-lg border object-cover"
            />
            {attachment.media_type === "gif" && (
              <span className="pointer-events-none absolute start-1 top-1 rounded bg-black/65 px-1 py-px text-[9px] font-bold text-white">
                GIF
              </span>
            )}
            <button
              type="button"
              onClick={() => setAttachment(null)}
              aria-label={t("removeAttachment")}
              className="absolute -end-2 -top-2 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        )}
        {mediaError && (
          <p role="alert" className="text-xs text-destructive">
            {mediaError}
          </p>
        )}

        {/* The box: text + tools */}
        <div
          className={cn(
            "rounded-2xl border bg-background transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30",
            (bodyError || tooLong) && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
          )}
        >
          <textarea
            ref={textareaRef}
            data-slot="comment-textarea"
            rows={1}
            value={text}
            autoFocus={autoFocus}
            readOnly={posting}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            aria-invalid={tooLong || !!bodyError || undefined}
            onChange={(event) => {
              touchEdit();
              setText(event.target.value);
              rememberCaret();
            }}
            onSelect={rememberCaret}
            onBlur={rememberCaret}
            onPaste={onPaste}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              // No Shift key on a touch keyboard: Enter is a new line there.
              if (window.matchMedia("(pointer: coarse)").matches) return;
              event.preventDefault();
              void send();
            }}
            className="block max-h-40 min-h-10 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm leading-relaxed outline-none placeholder:text-muted-foreground read-only:opacity-60"
          />

          <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
            <ExpressionPanel
              onEmojiSelect={insertEmoji}
              onGifSelect={pickGif}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={posting}
                  aria-label={t("emojiAndGifs")}
                  className="text-muted-foreground"
                >
                  <Smile aria-hidden />
                </Button>
              }
            />

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label={t("attachImage")}
              className="text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus aria-hidden />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void attachFile(file);
              }}
            />

            {text.length >= COUNTER_FROM && (
              <span
                className={cn(
                  "ms-auto me-1 text-[11px] tabular-nums",
                  tooLong ? "font-medium text-destructive" : "text-muted-foreground",
                )}
                aria-live="polite"
              >
                {text.length} / {COMMENT_MAX_LENGTH}
              </span>
            )}

            <Button
              type="button"
              size="icon-sm"
              disabled={!canSend}
              aria-label={posting ? t("sending") : t("send")}
              onClick={() => void send()}
              className={cn("rounded-full", text.length < COUNTER_FROM && "ms-auto")}
            >
              {posting ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <Send className="rtl:-scale-x-100" aria-hidden />
              )}
            </Button>
          </div>
        </div>

        {bodyError && (
          <p role="alert" className="text-xs text-destructive">
            {bodyError}
          </p>
        )}
        {tooLong && (
          <p role="alert" className="text-xs text-destructive">
            {t("tooLong", { max: COMMENT_MAX_LENGTH })}
          </p>
        )}

        {postError && !inlineOnly && (
          <AnnouncementErrorAlert
            error={postError}
            compact
            onRetry={() => void send()}
            onDismiss={() => clearPostError(announcementId)}
          />
        )}
      </div>
    </div>
  );
}
