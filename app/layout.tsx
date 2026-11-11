import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Area 14",
  description: "Enterprise-grade dashboard foundation",
};

// This is a minimal root layout - the actual layout with providers
// is in app/[locale]/layout.tsx
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
