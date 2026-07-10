// Shared layout for all inventory sub-pages (Units, Items, Links, Entries).
// Auth uses the dashboard session token automatically (see lib/api/inventory-client.ts),
// so there is no token bar to render here anymore.
export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="space-y-6">{children}</div>;
}
