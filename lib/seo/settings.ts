import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';

export interface SeoConfig {
  gscVerification: string | null;
  bingVerification: string | null;
  ga4Id: string | null;
  /** eNamad trust seal (id + code from the eNamad panel) */
  enamad: { id: string; code: string } | null;
}

/** Google/Bing verification codes and GA4 id: admin-editable, env vars as fallback. */
export const getSeoConfig = unstable_cache(
  async (): Promise<SeoConfig> => {
    let row: { gscVerification: string | null; bingId: string | null; ga4Id: string | null; enamadCode: string | null } | null = null;
    try {
      row = await db.seoSetting.findFirst({ select: { gscVerification: true, bingId: true, ga4Id: true, enamadCode: true } });
    } catch (err) {
      console.error('getSeoConfig: falling back to env', err);
    }
    return {
      gscVerification: row?.gscVerification || process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || null,
      bingVerification: row?.bingId || null,
      ga4Id: row?.ga4Id || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null,
      enamad: parseStoredEnamad(row?.enamadCode ?? null),
    };
  },
  ['seo-config'],
  { revalidate: 3600, tags: ['seo-settings'] }
);

/** GA4 ids look like G-XXXXXXX. Anything else is rejected so it can't inject script. */
export function isValidGa4Id(id: string): boolean {
  return /^G-[A-Z0-9]{4,16}$/.test(id);
}

/**
 * Accepts either the bare token or the full `<meta name="google-site-verification" content="...">`
 * tag Google shows, and returns just the token.
 */
export function extractVerificationToken(input: string): string {
  const m = input.match(/content=["']([^"']+)["']/);
  return (m ? m[1] : input).trim();
}

/**
 * eNamad gives site owners an HTML snippet containing ?id=NNN&Code=XXX. We keep only
 * those two values ("id|code") and render the seal ourselves, never raw HTML.
 */
export function parseEnamadSnippet(raw: string): { id: string; code: string } | null {
  const input = raw.replace(/&amp;/gi, '&');
  const id = input.match(/[?&]id=(\d{3,12})/i)?.[1];
  const code = input.match(/[?&]code=([A-Za-z0-9]{6,40})/i)?.[1];
  return id && code ? { id, code } : null;
}

export function parseStoredEnamad(stored: string | null): { id: string; code: string } | null {
  if (!stored) return null;
  const [id, code] = stored.split('|');
  return /^\d{3,12}$/.test(id ?? '') && /^[A-Za-z0-9]{6,40}$/.test(code ?? '') ? { id, code } : null;
}
