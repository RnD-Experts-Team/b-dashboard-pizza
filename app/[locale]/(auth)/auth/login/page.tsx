"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/use-auth";
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
import { PizzaLoader } from "@/components/shared/pizza-loader";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const { locale } = useParams();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError(t("error"));
      return;
    }

    try {
      await login({ email, password });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("failed"));
      }
    }
  };

  return (
    <>
      {/* {isLoading && <PizzaLoader />} */}
      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-2">
        {/* Form Side */}
        <div>
          <CardHeader className="space-y-1">
            {/* Mobile-only logo */}
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
                <Link
                  href={`/${locale}/auth/register`}
                  className="text-primary hover:underline"
                >
                  {t("register")}
                </Link>
              </p>
            </CardFooter>
          </form>
        </div>

        {/* Logo / Brand Side */}
        <div className="hidden md:flex flex-col items-center justify-center gap-4  from-muted/20 via-background to-muted/30 px-8 lg:px-12 py-0 border-l">
          <div className="rounded-2xl bg-background/80  px-24 py-6 shadow-sm ring-1 ring-black/5">
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
    </>
  );
}
