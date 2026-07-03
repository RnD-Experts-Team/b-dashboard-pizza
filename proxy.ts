import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "@/lib/i18n/config";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeDetection: true,
});

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Static files (/_next, /favicon.ico, etc.)
  // - Public files
  matcher: [
    // Exclude API routes (also covers the inventory route.ts proxies under
    // /api/inventory and /api/public/inventory), the inventory image storage
    // rewrite path, Next internals, and static files.
    "/((?!api|inventory-storage|_next|_vercel|.*\\..*).*)",
  ],
};
