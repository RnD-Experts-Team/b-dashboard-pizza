"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { firstFieldError, readReportError } from "@/lib/report-builder/errors";

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_GONE = 410;
const HTTP_UNPROCESSABLE = 422;
const HTTP_TOO_MANY = 429;
const HTTP_BAD_GATEWAY = 502;
const HTTP_UNAVAILABLE = 503;
const HTTP_GATEWAY_TIMEOUT = 504;

/** i18n key under reportBuilder.errors per HTTP status. */
const BY_STATUS: Record<number, string> = {
  [HTTP_BAD_REQUEST]: "badRequest",
  [HTTP_UNAUTHORIZED]: "unauthorized",
  [HTTP_FORBIDDEN]: "forbidden",
  [HTTP_NOT_FOUND]: "notFound",
  [HTTP_GONE]: "expired",
  [HTTP_CONFLICT]: "conflict",
  [HTTP_TOO_MANY]: "rateLimited",
  [HTTP_BAD_GATEWAY]: "upstream",
  [HTTP_UNAVAILABLE]: "busy",
  [HTTP_GATEWAY_TIMEOUT]: "timeout",
};

/**
 * One translated sentence for any Report Builder failure. A 422 shows Data's
 * own words: the first field message (e.g. the formula error), else the
 * response message (e.g. "a distinct count needs the store in the grain"),
 * and the translated generic sentence only when Data sent neither. Every
 * other failure is worded here, never by the BFF's English text.
 */
export function useErrorText() {
  const t = useTranslations("reportBuilder.errors");
  return useCallback(
    (err: unknown): string => {
      const e = readReportError(err);
      if (e.status === HTTP_UNPROCESSABLE) return firstFieldError(e) ?? (e.message.trim() || t("invalid"));
      const key = e.status !== null ? BY_STATUS[e.status] : undefined;
      if (key) return t(key);
      if (e.code === "NETWORK_ERROR") return t("network");
      return t("generic");
    },
    [t],
  );
}
