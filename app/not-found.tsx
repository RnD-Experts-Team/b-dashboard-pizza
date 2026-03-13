import Link from "next/link";
import { defaultLocale } from "@/lib/i18n/config";

/**
 * Root-level 404 page.
 * Catches notFound() calls that bubble past app/[locale]/layout.tsx —
 * typically invalid locale segments (e.g. /totally-wrong-path).
 * Must render its own <html> and <body> because app/layout.tsx is a
 * pass-through that returns children without them.
 */
export default function RootNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#09090b",
          color: "#fafafa",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            textAlign: "center",
            padding: "2rem",
          }}
        >
          <p
            style={{
              fontSize: "6rem",
              fontWeight: 700,
              lineHeight: 1,
              margin: 0,
              color: "#f97316",
            }}
          >
            404
          </p>

          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Page Not Found
          </h1>

          <p
            style={{
              fontSize: "0.9rem",
              color: "#a1a1aa",
              maxWidth: "36ch",
              margin: 0,
            }}
          >
            Sorry, the page you are looking for doesn&apos;t exist or has been
            moved.
          </p>

          <Link
            href={`/${defaultLocale}/dashboard`}
            style={{
              marginTop: "0.5rem",
              padding: "0.6rem 1.4rem",
              background: "#f97316",
              color: "#09090b",
              fontWeight: 600,
              borderRadius: "0.5rem",
              textDecoration: "none",
              fontSize: "0.875rem",
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      </body>
    </html>
  );
}
