/** Canonical public path for a service detail page. */
export function servicePath(slug: string): string {
  return `/services/${encodeURIComponent(slug)}`;
}
