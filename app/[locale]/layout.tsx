import type { Metadata, Viewport } from "next";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono, Noto_Sans_Arabic, Space_Grotesk, Playfair_Display, IBM_Plex_Mono, Oswald, Instrument_Sans } from "next/font/google";
import { FeatureProviders } from "@/components/providers/feature-providers";
import { Toaster } from "@/components/ui/sonner";
import { locales, localeDirections, type Locale } from "@/lib/i18n/config";
import { createFOUCPreventionScript } from "@/lib/theme";
import { isFeatureEnabled } from "@/lib/config";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/** Inline script that sets data-primary-font / data-secondary-font on <html> before React hydration */
function createFontPreferenceScript(): string {
  // Defaults: Oswald for primary, Instrument Sans for secondary
  return `(function(){try{var el=document.documentElement;el.removeAttribute("data-font-variant");var p="oswald",sec="instrumentSans";try{var s=localStorage.getItem("ui-storage");if(s){var d=JSON.parse(s);var st=d&&d.state;if(st&&st.primaryFont)p=st.primaryFont;if(st&&st.secondaryFont)sec=st.secondaryFont;}}catch(e){}if(p&&p!=="default")el.setAttribute("data-primary-font",p);else el.removeAttribute("data-primary-font");if(sec&&sec!=="default")el.setAttribute("data-secondary-font",sec);else el.removeAttribute("data-secondary-font");}catch(e){}})();`;
}

export const metadata: Metadata = {
  title: "Pizza Dashboard",
  description: "Enterprise-grade dashboard foundation",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Get messages for the locale
  const messages = await getMessages();

  const dir = localeDirections[locale as Locale];
  const isRtl = dir === "rtl";

  // Check if RTL support is enabled
  const rtlEnabled = isFeatureEnabled("rtlSupport");
  const effectiveDir = rtlEnabled ? dir : "ltr";
  const effectiveIsRtl = rtlEnabled && isRtl;

  return (
    <html lang={locale} dir={effectiveDir} suppressHydrationWarning>
      <head>
        {/* Theme FOUC prevention script - runs before React hydration */}
        <script
          dangerouslySetInnerHTML={{ __html: createFOUCPreventionScript() }}
        />
        {/* Font preference FOUC prevention */}
        <script
          dangerouslySetInnerHTML={{ __html: createFontPreferenceScript() }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansArabic.variable} ${spaceGrotesk.variable} ${playfairDisplay.variable} ${ibmPlexMono.variable} ${oswald.variable} ${instrumentSans.variable} ${effectiveIsRtl ? "font-(family-name:--font-noto-arabic)" : ""} antialiased`}
        suppressHydrationWarning
      >
        <FeatureProviders messages={messages} locale={locale}>
          {children}
          <Toaster />
        </FeatureProviders>
      </body>
    </html>
  );
}
