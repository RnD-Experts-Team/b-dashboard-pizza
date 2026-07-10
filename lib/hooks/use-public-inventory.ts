"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { publicInventoryService } from "@/lib/api/services/inventory.service";
import {
  getInventoryErrorMessage,
  isCanceledError,
} from "@/lib/api/inventory-errors";
import type {
  PublicLink,
  PublicSubmitItem,
  PublicSubmitResponse,
} from "@/types/inventory.types";

/** Distinguishable load outcomes for the public form. */
export type PublicLinkStatus =
  | "loading"
  | "ready"
  | "not_found" // 404 — invalid token
  | "submitted" // 410 — link already used
  | "error"; // network / unexpected

/**
 * Loads a public inventory link by token and exposes a submit action.
 * The 404 / 410 states are surfaced explicitly so the page can render the
 * right message (invalid vs. already-submitted) rather than a generic error.
 */
export function usePublicInventoryLink(token: string | null) {
  const [link, setLink] = useState<PublicLink | null>(null);
  const [status, setStatus] = useState<PublicLinkStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicSubmitResponse | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) {
        setStatus("not_found");
        return;
      }
      setStatus("loading");
      setError(null);
      try {
        const data = await publicInventoryService.getLink(token, signal);
        setLink(data);
        setStatus("ready");
      } catch (err) {
        if (isCanceledError(err)) return;
        const code = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (code === 404) {
          setStatus("not_found");
        } else if (code === 410) {
          setStatus("submitted");
        } else {
          setError(getInventoryErrorMessage(err, "Failed to load this link."));
          setStatus("error");
        }
      }
    },
    [token]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const submit = useCallback(
    async (items: PublicSubmitItem[]): Promise<PublicSubmitResponse> => {
      if (!token) throw new Error("Missing token.");
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const res = await publicInventoryService.submit(token, items);
        setResult(res);
        return res;
      } catch (err) {
        const code = axios.isAxiosError(err) ? err.response?.status : undefined;
        // If the link expired between load and submit, flip to the submitted state.
        if (code === 410) setStatus("submitted");
        if (code === 404) setStatus("not_found");
        setSubmitError(
          getInventoryErrorMessage(err, "Failed to submit your counts.")
        );
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [token]
  );

  return {
    link,
    status,
    error,
    submit,
    isSubmitting,
    submitError,
    result,
    reload: load,
  };
}
