"use client";

import { CircleCheck, Clock3, Minus } from "lucide-react";
import { fmtFixed } from "@/lib/utils/number-display";
import { cn } from "@/lib/utils";
import { formatDateOrTimestamp } from "@/lib/utils/date-display";
import {
  ATTENDANCE_BUCKETS,
  ATTENDANCE_BUCKET_LABELS,
  formatMinutes,
} from "@/lib/maintenance-tickets/attendance-durations";
import type {
  PaymentStatusField,
  PaymentStatusValue,
  RecordPaymentBlock,
  RecordPaymentClaim,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Payment status — has this record been paid?                              */
/*                                                                            */
/*  Being on a pay sheet IS being paid; there is no separate "money sent"     */
/*  step. The status is DERIVED ON READ from the sheets themselves, so it can */
/*  never disagree with them — nothing stores it.                            */
/*                                                                            */
/*  On a ticket ISSUE it is rolled up server-side, and ANYTHING STILL OWED    */
/*  DOMINATES: an issue reads unpaid until the last of its payables is        */
/*  settled, so an issue whose hours are paid but whose late receipt is not   */
/*  still shows unpaid. That is deliberate — it is the state finance cares    */
/*  about — and is why the issue badge carries an explanatory title.          */
/* ────────────────────────────────────────────────────────────────────────── */

/** Fallback copy for when the API sends an empty label. */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatusValue, string> = {
  unpaid: "Not yet paid",
  paid: "Paid",
  not_payable: "Nothing to pay",
};

/**
 * Colours. Every light value is paired with a `dark:` variant.
 *
 * `unpaid` is amber, not destructive: money still owed is a PENDING state, not
 * a fault, and `destructive` is already spoken for by the mistaken banner that
 * sits two lines above on the same card.
 */
const STATUS_CLASSES: Record<PaymentStatusValue, string> = {
  unpaid:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  paid:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  // Nothing is owed, so nothing should draw the eye. Pure semantic tokens.
  not_payable: "border-border bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<PaymentStatusValue, typeof Clock3> = {
  unpaid: Clock3,
  paid: CircleCheck,
  not_payable: Minus,
};

function isKnownStatus(value: string): value is PaymentStatusValue {
  return value === "unpaid" || value === "paid" || value === "not_payable";
}

interface PaymentStatusBadgeProps {
  status: PaymentStatusField | null | undefined;
  className?: string;
  title?: string;
}

export function PaymentStatusBadge({
  status,
  className,
  title,
}: PaymentStatusBadgeProps) {
  // `payment` is null when the claims were NOT LOADED. `payments: []` with an
  // `unpaid` status is a record that genuinely has not been paid. Rendering
  // "Not yet paid" for the first case asserts a fact we do not have — and
  // finance acts on this badge. Null renders NOTHING.
  if (!status) return null;

  // An unrecognised value (the API gains a fourth) falls through to the
  // neutral styling and shows its own label rather than crashing or hiding.
  const known = isKnownStatus(status.value);
  const Icon = known ? STATUS_ICONS[status.value] : Minus;
  const classes = known ? STATUS_CLASSES[status.value] : STATUS_CLASSES.not_payable;
  const label = status.label || (known ? PAYMENT_STATUS_LABELS[status.value] : status.value);

  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-medium",
        classes,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The claims behind a "Paid" badge                                         */
/* ────────────────────────────────────────────────────────────────────────── */

/** The minutes THIS payment counted — can differ from the entry's own
 *  durations when several payments touch the same record. */
function claimMinutesSummary(claim: RecordPaymentClaim): string | null {
  if (!claim.minutes) return null;
  const parts = ATTENDANCE_BUCKETS.filter((b) => claim.minutes![b] > 0).map(
    (b) => `${ATTENDANCE_BUCKET_LABELS[b]} ${formatMinutes(claim.minutes![b])}`
  );
  return parts.length ? parts.join(" · ") : null;
}

interface PaymentClaimListProps {
  payments: RecordPaymentClaim[];
  kind: "attendance" | "part";
  className?: string;
}

export function PaymentClaimList({
  payments,
  kind,
  className,
}: PaymentClaimListProps) {
  // Unpaid — the badge already said so; an empty list under it is noise.
  if (payments.length === 0) return null;

  return (
    <div className={cn("space-y-0.5", className)}>
      {payments.map((claim) => {
        const payee =
          claim.technician?.name ?? `Technician #${claim.technicianId}`;
        const detail =
          kind === "part"
            ? claim.amount != null
              ? `$${fmtFixed(claim.amount, 2)}`
              : null
            : claimMinutesSummary(claim);

        return (
          <p
            key={claim.dailyPayPaymentId}
            className="text-[11px] text-muted-foreground tabular-nums"
          >
            <span className="font-medium text-foreground">
              {formatDateOrTimestamp(claim.date, "MMM d")}
            </span>
            {" · "}
            {payee}
            {detail && (
              <>
                {" · "}
                {detail}
              </>
            )}
            <span className="ms-1 opacity-60">
              (sheet #{claim.dailyPayEntryId})
            </span>
          </p>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Null-safe wrapper, so call sites cannot get the null rule wrong          */
/* ────────────────────────────────────────────────────────────────────────── */

interface RecordPaymentBlockDisplayProps {
  payment: RecordPaymentBlock | null | undefined;
  kind: "attendance" | "part";
  className?: string;
}

/**
 * Renders the claims behind a record's payment status, or nothing at all when
 * the block was not loaded. Short-circuits on null itself so no caller needs a
 * guard — and so no caller can forget one.
 */
export function RecordPaymentBlockDisplay({
  payment,
  kind,
  className,
}: RecordPaymentBlockDisplayProps) {
  if (!payment) return null;
  if (payment.payments.length === 0) return null;

  return (
    <div className={cn("space-y-1 rounded-md bg-muted/40 px-2.5 py-1.5", className)}>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        Paid on
      </p>
      <PaymentClaimList payments={payment.payments} kind={kind} />
    </div>
  );
}
