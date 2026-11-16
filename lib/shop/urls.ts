/** Canonical storefront paths. Keep every link to products/categories going through here. */
export function productPath(slug: string): string {
  return `/product/${encodeURIComponent(slug)}`;
}

export function categoryPath(slug: string, page = 1): string {
  const base = `/shop/${encodeURIComponent(slug)}`;
  return page > 1 ? `${base}?page=${page}` : base;
}

/** Route params may arrive percent-encoded depending on the runtime; normalise them. */
export function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function brandPath(slug: string): string {
  return `/brand/${encodeURIComponent(slug)}`;
}
