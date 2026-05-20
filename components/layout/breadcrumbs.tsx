"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbsProps {
  pathname: string;
  className?: string;
}
//ji
interface BreadcrumbItem {
  label: string;
  href: string;
  key: string;
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Skip the first segment if it's a locale (en, ar, etc.)
  const locales = ["en", "ar"];
  const startIndex = locales.includes(segments[0]) ? 1 : 0;

  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    
    // Skip locale segment in breadcrumbs
    if (i < startIndex) continue;

    // Check if this is an ID segment for known detail routes
    const isStoreId = i > 0 && segments[i - 1] === "stores" && segment !== "stores";
    const isUserId =
      i > 0 && segments[i - 1] === "users" && segment !== "users" && segment !== "create";
    const isRoleId =
      i > 0 && segments[i - 1] === "roles" && segment !== "roles" && segment !== "create";
    const isAuthRuleId =
      i > 0 && segments[i - 1] === "auth-rules" && segment !== "auth-rules" && segment !== "create";

    const label = isStoreId
      ? "Store Details"
      : isUserId
      ? "User Details"
      : isRoleId
      ? "Role Details"
      : isAuthRuleId
      ? "Rule Details"
      : segment.charAt(0).toUpperCase() + segment.slice(1);

    const key = isStoreId ? "store-details" : isUserId ? "user-details" : isRoleId ? "role-details" : isAuthRuleId ? "rule-details" : segment;

    breadcrumbs.push({
      label,
      href: currentPath,
      key,
    });
  }

  return breadcrumbs;
}

export function Breadcrumbs({ pathname, className }: BreadcrumbsProps) {
  const t = useTranslations("breadcrumbs");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const breadcrumbs = generateBreadcrumbs(pathname);

  // Get translated label for a breadcrumb key

  // const getLabel = (key: string) => {
  //   try {
  //     return t(key);
  //   } catch {
  //     return key.charAt(0).toUpperCase() + key.slice(1);
  //   }
  // };
  
    // Get translated label for a breadcrumb key

  const getLabel = (key: string) => {
    try {
      const translated = t(key);
      // If the translation key doesn't exist, i18n returns the key itself
      // Check if it's actually a valid translation by comparing
      if (translated === key || translated.includes(`breadcrumbs.${key}`)) {
        return key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, " ");
      }
      return translated;
    } catch {
      return key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, " ");
    }
  };

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={tNav("breadcrumb")}
      className={cn("font-heading flex items-center text-sm", className)}
    >
      <ol className="flex items-center gap-1.5">
        <li>
          <Link
            href="/dashboard"
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">{tCommon("home")}</span>
          </Link>
        </li>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const label = getLabel(crumb.key);
          return (
            <li key={crumb.href} className="flex items-center gap-1.5">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {isLast ? (
                <span className="font-medium text-foreground">{label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
