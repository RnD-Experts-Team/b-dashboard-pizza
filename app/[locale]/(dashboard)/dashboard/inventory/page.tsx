"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Boxes, ClipboardList, Link2, Ruler } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Inventory hub page — entry point for the feature.
 * Links to each section; auth uses the dashboard session token automatically.
 */
export default function InventoryHubPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  // Cards linking to each inventory section.
  const sections = [
    {
      title: "Units",
      description: "Measurement units (Box, Piece, Carton…).",
      href: `/${locale}/dashboard/inventory/units`,
      icon: Ruler,
    },
    {
      title: "Items",
      description: "Catalog items with units, types and images.",
      href: `/${locale}/dashboard/inventory/items`,
      icon: Boxes,
    },
    {
      title: "Links",
      description: "Generate single-use count links per employee.",
      href: `/${locale}/dashboard/inventory/links`,
      icon: Link2,
    },
    {
      title: "Entries",
      description: "Review submitted counts and recount items.",
      href: `/${locale}/dashboard/inventory/entries`,
      icon: ClipboardList,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Management"
        description="Manage units, items, count links and submitted entries."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </span>
                <CardTitle className="text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
