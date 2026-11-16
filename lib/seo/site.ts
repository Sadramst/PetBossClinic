/** Canonical origin of the public site. All canonical/OG/JSON-LD URLs derive from this. */
export const SITE_URL = 'https://www.petbossclinic.com';

export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return p === '/' ? `${SITE_URL}/` : `${SITE_URL}${p}`;
}
