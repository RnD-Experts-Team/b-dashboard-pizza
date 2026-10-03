"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Paperclip, Send, StickyNote } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formErrors, parseTicketError } from "@/lib/toolbox-tickets/errors";
import { TicketFilePicker, fileErrorsFrom, hasBadFiles, withoutFileErrors } from "./file-picker";

/** Different limits upstream — don't share a validator. */
const LIMIT = { reply: 20_000, note: 10_000 } as const;
type Mode = keyof typeof LIMIT;

interface TicketComposerProps {
  onReply: (body: string, files: File[]) => Promise<unknown>;
  onNote: (body: string, files: File[]) => Promise<unknown>;
  onAttach: (files: File[]) => Promise<unknown>;
  onError: (err: unknown) => void;
}

/**
 * Reply (a message on the thread) or note (a remark on the ticket). Both need
 * the respond ability. Files without text go to `/attachments`. Never
 * auto-retried — there's no rate limit upstream, and a 10-file upload looping
 * would hurt.
 */
export function TicketComposer({ onReply, onNote, onAttach, onError }: TicketComposerProps) {
  const t = useTranslations("toolboxTickets.composer");
  const [mode, setMode] = useState<Mode>("reply");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const limit = LIMIT[mode];
  const over = body.length > limit;
  const canSend = !sending && !over && (body.trim().length > 0 || files.length > 0) && !hasBadFiles(files);

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setErrors({});
    try {
      const text = body.trim();
      if (!text) await onAttach(files);
      else if (mode === "reply") await onReply(text, files);
      else await onNote(text, files);
      toast.success(!text ? t("attached") : mode === "reply" ? t("replied") : t("noted"));
      setBody("");
      setFiles([]);
      setShowFiles(false);
    } catch (err) {
      const parsed = parseTicketError(err);
      const fe = formErrors(parsed);
      setErrors(fe);
      if (Object.keys(fileErrorsFrom(fe)).length) setShowFiles(true);
      if (!fe.body && !Object.keys(fileErrorsFrom(fe)).length) onError(parsed);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2" data-slot="ticket-composer">
      <div className="inline-flex rounded-md border p-0.5" role="tablist">
        {(["reply", "note"] as const).map((m) => {
          const Icon = m === "reply" ? MessageSquare : StickyNote;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              disabled={sending}
              onClick={() => setMode(m)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(m)}
            </button>
          );
        })}
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void send();
          }
        }}
        placeholder={mode === "reply" ? t("replyPlaceholder") : t("notePlaceholder")}
        disabled={sending}
        aria-invalid={over || Boolean(errors.body)}
        className="max-h-64 min-h-24 resize-y"
      />
      {errors.body && <p className="text-[11px] text-destructive">{errors.body}</p>}

      {showFiles && (
        <TicketFilePicker
          files={files}
          onChange={(next) => {
            setFiles(next);
            setErrors(withoutFileErrors);
          }}
          disabled={sending}
          serverErrors={fileErrorsFrom(errors)}
          compact
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={sending}
          onClick={() => setShowFiles((v) => !v)}
          className={cn("gap-1.5", files.length > 0 && "text-primary")}
        >
          <Paperclip className="h-3.5 w-3.5" />
          {files.length ? t("filesCount", { count: files.length }) : t("attach")}
        </Button>
        <span className={cn("text-[11px] tabular-nums text-muted-foreground", over && "text-destructive")}>
          {body.length.toLocaleString()} / {limit.toLocaleString()}
        </span>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">{t("shortcut")}</span>
        <Button size="sm" className="ms-auto gap-1.5" disabled={!canSend} onClick={() => void send()}>
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 rtl:-scale-x-100" />}
          {sending ? t("sending") : !body.trim() && files.length ? t("upload") : mode === "reply" ? t("sendReply") : t("addNote")}
        </Button>
      </div>
    </div>
  );
}
