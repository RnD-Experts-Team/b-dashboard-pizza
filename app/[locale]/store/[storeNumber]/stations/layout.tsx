import type { Metadata } from "next";

interface Props {
  params: Promise<{ locale: string; storeNumber: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, storeNumber } = await params;

  return {
    manifest: `/${locale}/store/${storeNumber}/stations/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Station",
    },
    icons: {
      apple: "/logo.svg",
    },
  };
}

export default function StationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
