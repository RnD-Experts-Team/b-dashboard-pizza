"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
 *  passport-ui — the content primitives for the Store Passport dialog.
 *
 *  `PassportRow` follows the house label/value shape used by `DetailField`
 *  in components/dspr/wbr-detail-dialog.tsx, including its render-nothing
 *  guard for empty values — store metadata fields are all optional, and a
 *  row reading "Address —" is worse than no row at all.
 * ────────────────────────────────────────────────────────────────────────── */

/** Copies text and toasts, with a two-second check-mark on the button. */
function useCopy(copiedLabel: string) {
  const [copied, setCopied] = useState(false);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(copiedLabel);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is unavailable over plain HTTP and in some embedded
      // browsers. Nothing to recover — the value is on screen to read.
    }
  };
  return { copied, copy };
}

/* ── Section — a titled block inside a tab ───────────────────────────────── */
export function PassportSection({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {icon}
          {title}
        </p>
        {action}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

/* ── Row — label on the start side, value on the end ─────────────────────── */
export function PassportRow({
  label,
  value,
  icon,
  copyable,
  href,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  /** Adds a copy button; requires `value` to be a plain string. */
  copyable?: string;
  href?: string;
  className?: string;
}) {
  const t = useTranslations("storePassport");
  const { copied, copy } = useCopy(t("copied"));

  // Same guard as DetailField: an absent value renders nothing rather than a
  // row whose whole content is a dash.
  if (value === null || value === undefined || value === "") return null;

  return (
    <div
      className={cn(
        "grid grid-cols-[110px_1fr] items-start gap-3 text-[12.5px] sm:grid-cols-[150px_1fr]",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="flex min-w-0 items-start gap-1.5">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-words text-primary underline-offset-2 hover:underline"
          >
            {value}
          </a>
        ) : (
          <span className="break-words">{value}</span>
        )}
        {copyable && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("copy")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => copy(copyable)}
          >
            {copied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />}
          </Button>
        )}
      </span>
    </div>
  );
}

/* ── Secret row — masked until deliberately revealed ─────────────────────── */
export function SecretRow({
  label,
  value,
  revealed,
  onToggle,
}: {
  label: ReactNode;
  value: string;
  revealed: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("storePassport");
  const { copied, copy } = useCopy(t("copied"));

  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12.5px] sm:grid-cols-[150px_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        {/* Fixed-width mask so revealing doesn't shift the buttons beside it. */}
        <span className="min-w-0 break-all font-mono text-[12px] tabular-nums">
          {revealed ? value : "••••••••"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={revealed ? t("hide") : t("reveal")}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onToggle}
        >
          {revealed ? <EyeOff /> : <Eye />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("copy")}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => copy(value)}
        >
          {copied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />}
        </Button>
      </span>
    </div>
  );
}
