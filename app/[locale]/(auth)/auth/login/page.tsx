"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Eye, EyeOff } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types & helpers                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */

type LastLogin = { name: string; email: string; avatar: string | null };
type LoginMode = "full" | "picker" | "password";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Component                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const { locale } = useParams();
  const { login, isLoading } = useAuth();

  // Standard form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Remembered-user state
  const [lastLogin, setLastLogin] = useState<LastLogin | null>(null);
  const [mode, setMode] = useState<LoginMode>("full");
  const passwordRef = useRef<HTMLInputElement>(null);

  // ── Read remembered user from localStorage on mount ──────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth-last-login");
      if (raw) {
        const parsed = JSON.parse(raw) as LastLogin;
        if (parsed?.email && parsed?.name) {
          setLastLogin(parsed);
          setMode("picker");
        }
      }
    } catch {
      // Malformed JSON or localStorage unavailable — stay in "full" mode
    }
  }, []);

  // ── Autofocus password input when transitioning to password mode ──────────
  useEffect(() => {
    if (mode === "password") {
      const timer = setTimeout(() => passwordRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handlePickerClick() {
    setMode("password");
    setError("");
  }

  function handleDifferentAccount() {
    localStorage.removeItem("auth-last-login");
    setLastLogin(null);
    setMode("full");
    setEmail("");
    setPassword("");
    setError("");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const submitEmail = mode === "password" ? lastLogin!.email : email;

    if (!submitEmail || !password) {
      setError(t("error"));
      return;
    }

    try {
      await login({ email: submitEmail, password });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("failed"));
      }
    }
  };

  // ── Shared mobile logo ───────────────────────────────────────────────────
  const mobileLogo = (
    <div className="flex items-center justify-center mb-4 md:hidden">
      <Image
        src="/logo.svg"
        alt="Logo"
        width={64}
        height={64}
        className="h-16 w-16 object-contain"
        priority
      />
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <div className="grid md:grid-cols-2">

        {/* ── FORM SIDE ─────────────────────────────────────────────────── */}
        <div>

          {/* ── Mode A: Standard email + password form ─────────────────── */}
          {mode === "full" && (
            <>
              <CardHeader className="space-y-1">
                {mobileLogo}
                <CardTitle className="text-2xl text-center">{t("title")}</CardTitle>
                <CardDescription className="text-center">
                  {t("description")}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 pb-6">
                  {error && (
                    <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{t("password")}</Label>
                      <Link
                        href={`/${locale}/auth/forgot-password`}
                        className="text-sm text-muted-foreground hover:text-primary"
                      >
                        {t("forgotPassword")}
                      </Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t("passwordPlaceholder")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        autoComplete="current-password"
                        className="pe-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute end-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        <span className="sr-only">
                          {showPassword ? "Hide password" : "Show password"}
                        </span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 pt-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {t("signIn")}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    {t("noAccount")}{" "}
                    <a
                      href="https://www.cognitoforms.com/pnepizza/dashboardonboardingform/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {t("register")}
                    </a>
                  </p>
                </CardFooter>
              </form>
            </>
          )}

          {/* ── Mode B1: Avatar picker ──────────────────────────────────── */}
          {mode === "picker" && lastLogin && (
            <>
              <CardHeader className="space-y-1">
                {mobileLogo}
                <CardTitle className="text-2xl text-center">{t("title")}</CardTitle>
                <CardDescription className="text-center">
                  {t("description")}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col items-center gap-3 pb-6">
                {error && (
                  <div className="w-full p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                    {error}
                  </div>
                )}

                {/* Clickable avatar card */}
                <div
                  className="flex flex-col items-center gap-4 py-6 px-4 w-full rounded-xl cursor-pointer group hover:bg-muted/50 transition-colors duration-200"
                  onClick={handlePickerClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handlePickerClick()}
                  aria-label={`Sign in as ${lastLogin.name}`}
                >
                  <Avatar className="h-24 w-24 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all duration-200">
                    <AvatarImage src={lastLogin.avatar ?? undefined} alt={lastLogin.name} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary font-semibold">
                      {getInitials(lastLogin.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center space-y-0.5">
                    <p className="font-semibold text-lg leading-tight">{lastLogin.name}</p>
                    <p className="text-sm text-muted-foreground">{lastLogin.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors duration-150">
                    {t("clickToSignIn")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDifferentAccount}
                  className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors duration-150"
                >
                  {t("useDifferentAccount")}
                </button>
              </CardContent>
            </>
          )}

          {/* ── Mode B2: Password entry for remembered user ─────────────── */}
          {mode === "password" && lastLogin && (
            <>
              <CardHeader className="space-y-1">
                {mobileLogo}
                <CardTitle className="text-2xl text-center">{t("title")}</CardTitle>
              </CardHeader>

              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 pb-6">
                  {error && (
                    <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                      {error}
                    </div>
                  )}

                  {/* Compact identity strip */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/60">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={lastLogin.avatar ?? undefined} alt={lastLogin.name} />
                      <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                        {getInitials(lastLogin.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{lastLogin.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{lastLogin.email}</p>
                    </div>
                  </div>

                  {/* Password field */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{t("password")}</Label>
                      <Link
                        href={`/${locale}/auth/forgot-password`}
                        className="text-sm text-muted-foreground hover:text-primary"
                      >
                        {t("forgotPassword")}
                      </Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        ref={passwordRef}
                        type={showPassword ? "text" : "password"}
                        placeholder={t("passwordPlaceholder")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        autoComplete="current-password"
                        className="pe-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute end-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        <span className="sr-only">
                          {showPassword ? "Hide password" : "Show password"}
                        </span>
                      </Button>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4 pt-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {t("signIn")}
                  </Button>
                  <button
                    type="button"
                    onClick={handleDifferentAccount}
                    className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors duration-150"
                  >
                    {t("notYou")} {t("useDifferentAccount")}
                  </button>
                </CardFooter>
              </form>
            </>
          )}
        </div>

        {/* ── BRAND SIDE (unchanged) ───────────────────────────────────── */}
        <div className="hidden md:flex flex-col items-center justify-center gap-4 from-muted/20 via-background to-muted/30 px-8 lg:px-12 py-0 border-l">
          <div className="rounded-2xl bg-background/80 px-24 py-6 shadow-sm ring-1 ring-black/5">
            <Image
              src="/logo.svg"
              alt="Logo"
              width={180}
              height={180}
              className="h-32 w-32 lg:h-44 lg:w-44 object-contain"
              priority
            />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            Pizza Dashboard
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-60">
            Manage your stores, track performance, and streamline operations.
          </p>
        </div>

      </div>
    </Card>
  );
}
