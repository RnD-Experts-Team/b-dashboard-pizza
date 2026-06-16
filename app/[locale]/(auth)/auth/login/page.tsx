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
import { Eye, EyeOff, X, ChevronRight, UserPlus } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types & helpers                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */

type SavedAccount = { name: string; email: string; avatar: string | null };
type LoginMode = "full" | "picker" | "password";

const ACCOUNTS_KEY = "auth-saved-accounts";
const MAX_SAVED = 5;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/** Read saved accounts from localStorage, with one-time migration from the old single-account key. */
function readSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (a: unknown): a is SavedAccount =>
            typeof (a as SavedAccount)?.email === "string" &&
            typeof (a as SavedAccount)?.name === "string"
        );
      }
    }
    // One-time migration: read the old single-account key and promote to array
    const legacy = localStorage.getItem("auth-last-login");
    if (legacy) {
      const parsed = JSON.parse(legacy) as SavedAccount;
      if (parsed?.email && parsed?.name) {
        const accounts: SavedAccount[] = [
          { name: parsed.name, email: parsed.email, avatar: parsed.avatar ?? null },
        ];
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
        return accounts;
      }
    }
  } catch {
    // Malformed JSON or localStorage unavailable
  }
  return [];
}

function writeSavedAccounts(accounts: SavedAccount[]) {
  try {
    if (accounts.length > 0) {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } else {
      localStorage.removeItem(ACCOUNTS_KEY);
    }
  } catch {
    // ignore
  }
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

  // Multi-account state
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);
  const [mode, setMode] = useState<LoginMode>("full");
  const passwordRef = useRef<HTMLInputElement>(null);

  // ── Read saved accounts from localStorage on mount ───────────────────────
  useEffect(() => {
    const accounts = readSavedAccounts();
    setSavedAccounts(accounts);
    if (accounts.length > 0) setMode("picker");
  }, []);

  // ── Autofocus password input when transitioning to password mode ──────────
  useEffect(() => {
    if (mode === "password") {
      const timer = setTimeout(() => passwordRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handlePickAccount(account: SavedAccount) {
    setSelectedAccount(account);
    setMode("password");
    setPassword("");
    setError("");
  }

  function handleRemoveAccount(emailToRemove: string) {
    const updated = savedAccounts.filter((a) => a.email !== emailToRemove);
    setSavedAccounts(updated);
    writeSavedAccounts(updated);
    // If we removed the currently-selected account, navigate appropriately
    if (selectedAccount?.email === emailToRemove) {
      setSelectedAccount(null);
      setPassword("");
      setError("");
      setMode(updated.length > 0 ? "picker" : "full");
    }
    // If picker is now empty, move to full form
    if (updated.length === 0 && mode === "picker") {
      setMode("full");
    }
  }

  function handleBackToAccounts() {
    setMode("picker");
    setPassword("");
    setError("");
  }

  function handleUseDifferentAccount() {
    setMode("full");
    setEmail("");
    setPassword("");
    setError("");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const submitEmail = mode === "password" ? selectedAccount!.email : email;

    if (!submitEmail || !password) {
      setError(t("error"));
      return;
    }

    try {
      await login({ email: submitEmail, password });
      // auth store updates savedAccounts in localStorage; re-read after login
      const updated = readSavedAccounts();
      setSavedAccounts(updated);
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
                  {savedAccounts.length > 0 && (
                    <button
                      type="button"
                      onClick={handleBackToAccounts}
                      className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors duration-150"
                    >
                      ← {t("backToAccounts")}
                    </button>
                  )}
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

          {/* ── Mode B1: Multi-account picker ──────────────────────────── */}
          {mode === "picker" && savedAccounts.length > 0 && (
            <>
              <CardHeader className="space-y-1">
                {mobileLogo}
                <CardTitle className="text-2xl text-center">{t("title")}</CardTitle>
                <CardDescription className="text-center">
                  {t("description")}
                </CardDescription>
              </CardHeader>

              <CardContent className="pb-6">
                {error && (
                  <div className="mb-3 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                    {error}
                  </div>
                )}

                {/* Account list */}
                <div className="space-y-1">
                  {savedAccounts.map((account) => (
                    <div
                      key={account.email}
                      className="group flex items-center rounded-lg border border-transparent hover:border-border/60 hover:bg-muted/50 transition-colors duration-150"
                    >
                      {/* Clickable main row */}
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-3 py-2.5 ps-3 pe-1 text-start min-w-0"
                        onClick={() => handlePickAccount(account)}
                        aria-label={`Sign in as ${account.name}`}
                      >
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={account.avatar ?? undefined} alt={account.name} />
                          <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                            {getInitials(account.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight truncate">
                            {account.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {account.email}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors duration-150" />
                      </button>

                      {/* Remove button — visible on hover */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 me-1.5 shrink-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all duration-150"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAccount(account.email);
                        }}
                        aria-label={t("removeAccount")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Use a different account */}
                <div className="mt-4 pt-3 border-t flex justify-center">
                  <button
                    type="button"
                    onClick={handleUseDifferentAccount}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors duration-150"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t("useDifferentAccount")}
                  </button>
                </div>
              </CardContent>
            </>
          )}

          {/* ── Mode B2: Password entry for selected account ────────────── */}
          {mode === "password" && selectedAccount && (
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
                      <AvatarImage
                        src={selectedAccount.avatar ?? undefined}
                        alt={selectedAccount.name}
                      />
                      <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                        {getInitials(selectedAccount.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{selectedAccount.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {selectedAccount.email}
                      </p>
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
                  {/* Back to accounts list (only shown when there are other accounts) */}
                  <button
                    type="button"
                    onClick={handleBackToAccounts}
                    className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors duration-150"
                  >
                    ← {t("backToAccounts")}
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
