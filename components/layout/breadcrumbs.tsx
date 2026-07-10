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
  /** False when this segment has no real page of its own (e.g. an ID that
   *  only exists under .../edit) — rendered as plain text instead of a link
   *  so the trail never points at a 404. Defaults to true. */
  clickable?: boolean;
}

/**
 * Resources whose ID segment has no standalone "view" page — only
 * `.../{id}/edit` (or similar) exists. Their ID crumb is rendered as text.
 * Resources with a real detail page (stores, users, roles, auth-rules) are
 * handled separately below and stay clickable.
 */
const EDIT_ONLY_RESOURCES = ["items"];

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

    // Inventory sub-pages breadcrumb directly under Dashboard (e.g.
    // "Dashboard > Items"), matching the flat pattern used elsewhere
    // (e.g. "Dashboard > Hiring request") instead of "Dashboard > Inventory > Items".
    if (segment === "inventory") continue;

    // Check if this is an ID segment for known detail routes
    const isStoreId = i > 0 && segments[i - 1] === "stores" && segment !== "stores";
    const isUserId =
      i > 0 && segments[i - 1] === "users" && segment !== "users" && segment !== "create";
    const isRoleId =
      i > 0 && segments[i - 1] === "roles" && segment !== "roles" && segment !== "create";
    const isAuthRuleId =
      i > 0 && segments[i - 1] === "auth-rules" && segment !== "auth-rules" && segment !== "create";
    const isEditOnlyResourceId =
      i > 0 &&
      EDIT_ONLY_RESOURCES.includes(segments[i - 1]) &&
      segment !== segments[i - 1] &&
      segment !== "create";

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
      clickable: !isEditOnlyResourceId,
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
          // Only render a link when this segment resolves to a real page —
          // the last crumb (current page) and any "no page of its own" segment
          // (e.g. an items/{id} that only has .../edit) render as plain text.
          const isLink = !isLast && crumb.clickable !== false;
          return (
            <li key={crumb.href} className="flex items-center gap-1.5">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {isLink ? (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {label}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
