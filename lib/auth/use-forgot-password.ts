"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authService } from "@/lib/api/services/auth.service";

export type ForgotPasswordStep = "email" | "otp" | "reset" | "done";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Drives the 3-step forgot-password wizard (request OTP → verify OTP → set
 * new password). Kept as plain component state (matching `use-auth.ts`'s
 * style) rather than a global store — this flow only matters for the
 * lifetime of the forgot-password page, and the OTP/email should never be
 * persisted anywhere.
 */
export function useForgotPassword() {
  const [step, setStep] = useState<ForgotPasswordStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const requestOtp = useCallback(
    async (targetEmail: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await authService.forgotPassword(targetEmail);
        setEmail(targetEmail);
        setStep("otp");
        startCooldown();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to send verification code.");
      } finally {
        setIsLoading(false);
      }
    },
    [startCooldown]
  );

  const resendOtp = useCallback(async () => {
    if (resendCooldown > 0 || !email) return;
    setIsLoading(true);
    setError(null);
    try {
      await authService.forgotPassword(email);
      startCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend verification code.");
    } finally {
      setIsLoading(false);
    }
  }, [email, resendCooldown, startCooldown]);

  const verifyOtp = useCallback(
    async (code: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await authService.verifyResetOtp(email, code);
        setOtp(code);
        setStep("reset");
      } catch (err) {
        setError(err instanceof Error ? err.message : "That code is invalid or has expired.");
      } finally {
        setIsLoading(false);
      }
    },
    [email]
  );

  const resetPassword = useCallback(
    async (password: string, passwordConfirmation: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await authService.resetPassword(email, otp, password, passwordConfirmation);
        setStep("done");
        // Clear the OTP from memory now that it's been consumed.
        setOtp("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to reset password.");
      } finally {
        setIsLoading(false);
      }
    },
    [email, otp]
  );

  const goBack = useCallback(() => {
    setError(null);
    setStep((prev) => (prev === "reset" ? "otp" : prev === "otp" ? "email" : prev));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    step,
    email,
    isLoading,
    error,
    resendCooldown,
    requestOtp,
    resendOtp,
    verifyOtp,
    resetPassword,
    goBack,
    clearError,
  };
}
