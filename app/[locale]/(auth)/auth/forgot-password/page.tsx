"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ArrowLeft, ArrowRight, CheckCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useForgotPassword } from "@/lib/auth/use-forgot-password";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const { locale } = useParams();
  const isRtl = locale === "ar";
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const {
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
  } = useForgotPassword();

  const [emailInput, setEmailInput] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || error;

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    if (!emailInput) {
      setLocalError(t("description"));
      return;
    }
    requestOtp(emailInput.trim().toLowerCase());
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    if (otpValue.length !== 6) return;
    verifyOtp(otpValue);
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (password.length < 8) {
      setLocalError(t("passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setLocalError(t("passwordMismatch"));
      return;
    }
    setLocalError(null);
    resetPassword(password, confirmPassword);
  };

  if (step === "done") {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">{t("successTitle")}</CardTitle>
          <CardDescription className="text-center">{t("successDescription")}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href={`/${locale}/auth/login`} className="w-full">
            <Button variant="outline" className="w-full">
              <BackArrow className="me-2 h-4 w-4" />
              {t("backToLogin")}
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (step === "otp") {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <span className="text-xl font-bold">B</span>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">{t("checkEmail")}</CardTitle>
          <CardDescription className="text-center">
            {t("checkEmailDescription", { email })}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleOtpSubmit}>
          <CardContent className="space-y-4 pb-6">
            {displayError && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {displayError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="otp">{t("otpLabel")}</Label>
              <InputOTP
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                value={otpValue}
                onChange={setOtpValue}
                disabled={isLoading}
                autoComplete="one-time-code"
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2">
            <Button type="submit" className="w-full" disabled={isLoading || otpValue.length !== 6}>
              {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("verify")}
            </Button>
            <div className="flex items-center justify-between w-full text-sm">
              <button
                type="button"
                onClick={goBack}
                className="text-muted-foreground hover:text-primary flex items-center gap-2"
              >
                <BackArrow className="h-4 w-4" />
                {t("changeEmail")}
              </button>
              <button
                type="button"
                onClick={resendOtp}
                disabled={resendCooldown > 0 || isLoading}
                className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? t("resendCodeIn", { seconds: resendCooldown }) : t("resendCode")}
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    );
  }

  if (step === "reset") {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <span className="text-xl font-bold">B</span>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">{t("resetTitle")}</CardTitle>
          <CardDescription className="text-center">{t("resetDescription")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleResetSubmit}>
          <CardContent className="space-y-4 pb-6">
            {displayError && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {displayError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("newPassword")}</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="pe-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute end-0 top-0 h-full px-3 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">{t("confirmNewPassword")}</Label>
              <div className="relative">
                <Input
                  id="confirm-new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="pe-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute end-0 top-0 h-full px-3 text-muted-foreground"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("resetSubmit")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-xl font-bold">B</span>
          </div>
        </div>
        <CardTitle className="text-2xl text-center">{t("title")}</CardTitle>
        <CardDescription className="text-center">{t("description")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleEmailSubmit}>
        <CardContent className="space-y-4 pb-6">
          {displayError && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {displayError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("submit")}
          </Button>
          <Link
            href={`/${locale}/auth/login`}
            className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-2"
          >
            <BackArrow className="h-4 w-4" />
            {t("backToLogin")}
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
