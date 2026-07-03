/**
 * Build the employee-facing public count-form URL for a link token.
 *
 * The backend's LinkResource `url` points at the raw API JSON endpoint
 * (/api/public/inventory/{token}); employees need the rendered form page
 * instead. This constructs the same-origin frontend route for the current
 * locale so a copied link opens the form.
 */
export function publicCountUrl(locale: string, token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/${locale}/inventory/count/${token}`;
}
