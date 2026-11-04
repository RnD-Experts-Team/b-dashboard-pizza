import { z } from "zod";
import type {
  ReportSchedule,
  RunFormat,
  ScheduleDelivery,
  ScheduleFrequency,
  ScheduleInput,
} from "@/types/report-builder.types";
import { formatCell } from "./format";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Report schedules — the form schema, the wire body and the display text.   */
/*  Pure, no React.                                                           */
/*                                                                            */
/*  Weekday numbering: 0 = Sunday … 6 = Saturday (Carbon `dayOfWeek`, JS      */
/*  `Date#getDay`). `weekday` is sent only for weekly schedules and           */
/*  `day_of_month` (1–31, clamped to a shorter month's last day) only for     */
/*  monthly ones; the other is null.                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export const SCHEDULE_FREQUENCIES = ["daily", "weekly", "monthly"] as const satisfies readonly ScheduleFrequency[];
export const SCHEDULE_FORMATS = ["csv", "xlsx"] as const satisfies readonly RunFormat[];
export const SCHEDULE_DELIVERIES = ["link", "attachment", "both"] as const satisfies readonly ScheduleDelivery[];
const DAYS_IN_WEEK = 7;
const MAX_WEEKDAY = DAYS_IN_WEEK - 1;
const MAX_DAY_OF_MONTH = 31;
/** 0 = Sunday … 6 = Saturday. */
export const WEEKDAYS: readonly number[] = Array.from({ length: DAYS_IN_WEEK }, (_, i) => i);
export const DAYS_OF_MONTH: readonly number[] = Array.from({ length: MAX_DAY_OF_MONTH }, (_, i) => i + 1);

export const DEFAULT_RUN_TIME = "07:00";
const DEFAULT_WEEKDAY = 1;
const DEFAULT_DAY_OF_MONTH = 1;
const TIME_LENGTH = 5;

/** The short list of zones a schedule can run in; `key` is the i18n key under `schedules.timezones`. */
export const SCHEDULE_TIMEZONES = [
  { id: "America/New_York", key: "newYork" },
  { id: "America/Chicago", key: "chicago" },
  { id: "America/Denver", key: "denver" },
  { id: "America/Los_Angeles", key: "losAngeles" },
  { id: "Asia/Damascus", key: "damascus" },
  { id: "UTC", key: "utc" },
] as const;
export const DEFAULT_TIMEZONE = "America/New_York";

// 24-hour wall-clock time "07:00" or "23:59"; rejects "7:00", "24:00" and "07:60".
// Tester: https://regex101.com/?flavor=javascript&regex=%5E(%3F%3A%5B01%5D%5Cd%7C2%5B0-3%5D)%3A%5B0-5%5D%5Cd%24&testString=07%3A00
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** next-intl's `t`, or anything shaped like it. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** "07:00:00" (a database time) → "07:00". */
export function normalizeTime(value: string | null | undefined): string {
  return (value ?? "").slice(0, TIME_LENGTH);
}

/** Form schema; `t` is scoped to `reportBuilder.schedules.validation`. */
export function scheduleFormSchema(t: Translate) {
  return z.object({
    template_id: z.string().min(1, t("templateRequired")),
    frequency: z.enum(SCHEDULE_FREQUENCIES),
    run_time: z.string().regex(TIME_RE, t("timeInvalid")),
    // Always a valid number in the form; only the one matching `frequency` is sent.
    weekday: z.number().int().min(0, t("weekdayInvalid")).max(MAX_WEEKDAY, t("weekdayInvalid")),
    day_of_month: z.number().int().min(1, t("dayOfMonthInvalid")).max(MAX_DAY_OF_MONTH, t("dayOfMonthInvalid")),
    timezone: z.string().min(1, t("timezoneRequired")),
    /** User ids. */
    recipients: z.array(z.string().min(1)).min(1, t("recipientsRequired")),
    format: z.enum(SCHEDULE_FORMATS),
    delivery: z.enum(SCHEDULE_DELIVERIES),
    is_active: z.boolean(),
  });
}

export type ScheduleFormValues = z.infer<ReturnType<typeof scheduleFormSchema>>;

/** Recipient user ids of a schedule, as strings. */
export function recipientIds(schedule: Pick<ReportSchedule, "recipients">): string[] {
  const users = schedule.recipients?.users;
  return Array.isArray(users) ? users.map(String) : [];
}

/** Form values for a new schedule (`templateId` preselects the report, `userId` the first recipient) or an existing one. */
export function defaultScheduleValues(
  schedule: ReportSchedule | null,
  templateId: string | null,
  userId: string | null,
): ScheduleFormValues {
  if (schedule) {
    return {
      template_id: String(schedule.template_id),
      frequency: schedule.frequency,
      run_time: normalizeTime(schedule.run_time) || DEFAULT_RUN_TIME,
      weekday: schedule.weekday ?? DEFAULT_WEEKDAY,
      day_of_month: schedule.day_of_month ?? DEFAULT_DAY_OF_MONTH,
      timezone: schedule.timezone || DEFAULT_TIMEZONE,
      recipients: recipientIds(schedule),
      format: schedule.format,
      delivery: schedule.delivery,
      is_active: schedule.is_active,
    };
  }
  return {
    template_id: templateId ?? "",
    frequency: "weekly",
    run_time: DEFAULT_RUN_TIME,
    weekday: DEFAULT_WEEKDAY,
    day_of_month: DEFAULT_DAY_OF_MONTH,
    timezone: DEFAULT_TIMEZONE,
    recipients: userId ? [userId] : [],
    format: "xlsx",
    delivery: "both",
    is_active: true,
  };
}

// A whole-number id such as "42", sent as a number; ULIDs and other ids stay text.
// Tester: https://regex101.com/?flavor=javascript&regex=%5E%5Cd%2B%24&testString=42
const NUMERIC_ID_RE = /^\d+$/;
const asId = (id: string): number | string => (NUMERIC_ID_RE.test(id) ? Number(id) : id);

/**
 * The request body for create (POST) and update (PUT): every field, with the
 * weekday / day of month that does not apply to the frequency sent as null.
 */
export function toScheduleInput(values: ScheduleFormValues): ScheduleInput {
  return {
    template_id: asId(values.template_id),
    frequency: values.frequency,
    run_time: values.run_time,
    weekday: values.frequency === "weekly" ? values.weekday : null,
    day_of_month: values.frequency === "monthly" ? values.day_of_month : null,
    timezone: values.timezone,
    recipients: { users: values.recipients.map(Number).filter(Number.isFinite) },
    format: values.format,
    delivery: values.delivery,
    is_active: values.is_active,
  };
}

/** The body that re-sends an existing schedule unchanged except for `patch` (pause / resume). */
export function scheduleToInput(schedule: ReportSchedule, patch: Partial<ScheduleInput> = {}): ScheduleInput {
  return { ...toScheduleInput(defaultScheduleValues(schedule, null, null)), ...patch };
}

/** "Weekly · Tue 07:00 America/New_York"; `t` is scoped to `reportBuilder.schedules`. */
export function describeSchedule(schedule: ReportSchedule, t: Translate): string {
  const time = normalizeTime(schedule.run_time);
  const timezone = schedule.timezone;
  if (schedule.frequency === "weekly") {
    const day = schedule.weekday !== null && schedule.weekday !== undefined ? t(`weekdaysShort.${schedule.weekday}`) : "";
    return t("summary.weekly", { day, time, timezone });
  }
  if (schedule.frequency === "monthly") {
    return t("summary.monthly", { day: String(schedule.day_of_month ?? ""), time, timezone });
  }
  return t("summary.daily", { time, timezone });
}

const NO_LABELS = { yes: "", no: "" };

const whenLabel = (iso: string | null | undefined, locale: string): string =>
  iso ? formatCell(iso, { type: "datetime" }, locale, NO_LABELS) : "";

/** The next run in the viewer's own time zone; empty when paused or not yet planned. */
export function nextRunLabel(schedule: Pick<ReportSchedule, "is_active" | "next_run_at">, locale: string): string {
  return schedule.is_active ? whenLabel(schedule.next_run_at, locale) : "";
}

/** The last run in the viewer's own time zone; empty when it has never run. */
export function lastRunLabel(schedule: Pick<ReportSchedule, "last_run_at">, locale: string): string {
  return whenLabel(schedule.last_run_at, locale);
}
