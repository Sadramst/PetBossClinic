import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';

export interface SeoConfig {
  gscVerification: string | null;
  bingVerification: string | null;
  ga4Id: string | null;
}

/** Google/Bing verification codes and GA4 id: admin-editable, env vars as fallback. */
export const getSeoConfig = unstable_cache(
  async (): Promise<SeoConfig> => {
    let row: { gscVerification: string | null; bingId: string | null; ga4Id: string | null } | null = null;
    try {
      row = await db.seoSetting.findFirst({ select: { gscVerification: true, bingId: true, ga4Id: true } });
    } catch (err) {
      console.error('getSeoConfig: falling back to env', err);
    }
    return {
      gscVerification: row?.gscVerification || process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || null,
      bingVerification: row?.bingId || null,
      ga4Id: row?.ga4Id || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null,
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
