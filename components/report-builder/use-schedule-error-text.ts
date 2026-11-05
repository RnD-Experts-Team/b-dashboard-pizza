"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { readReportError } from "@/lib/report-builder/errors";
import { useErrorText } from "./use-error-text";

const HTTP_UNAVAILABLE = 503;

/**
 * `useErrorText` for schedule writes: a 503 from the BFF's "busy" mapping means
 * pizzasys could not mint or revoke the schedule's token, so it gets its own
 * sentence (a network failure is also a 503 but keeps the generic wording).
 */
export function useScheduleErrorText() {
  const t = useTranslations("reportBuilder.schedules.errors");
  const errorText = useErrorText();
  return useCallback(
    (err: unknown): string => {
      const e = readReportError(err);
      if (e.status === HTTP_UNAVAILABLE && e.code === "SERVICE_BUSY") return t("tokenFailed");
      return errorText(err);
    },
    [errorText, t],
  );
}
