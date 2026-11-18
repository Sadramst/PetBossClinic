import { NextRequest, NextResponse } from 'next/server';
import { feedProducts, toTorob, type FeedSort } from '@/lib/shop/feeds';
import { decodeSlug } from '@/lib/shop/urls';

export const dynamic = 'force-dynamic';

/**
 * Torob shop API (v3 response format). Register this URL in the Torob seller panel:
 *   https://www.petbossclinic.com/feeds/torob
 * Accepts GET ?page=N or POST {"page": N, "sort": "date_added_desc"|"date_updated_desc"}
 * or POST {"page_urls": [...]} / {"page_uniques": [...]} for specific products.
 */
async function handle(input: { page?: number; sort?: FeedSort; page_urls?: string[]; page_uniques?: string[] }) {
  let slugs: string[] | undefined;
  if (Array.isArray(input.page_urls) && input.page_urls.length) {
    slugs = input.page_urls
      .slice(0, 100)
      .map((u) => {
        try {
          const m = new URL(String(u)).pathname.match(/^\/product\/([^/]+)/);
          return m ? decodeSlug(m[1]) : null;
        } catch {
          return null;
        }
      })
      .filter((s): s is string => !!s);
  }
  const ids = Array.isArray(input.page_uniques) && input.page_uniques.length ? input.page_uniques.slice(0, 100).map(String) : undefined;
  const { total, page, maxPages, rows } = await feedProducts({
    page: Number(input.page) || 1,
    sort: input.sort === 'date_updated_desc' ? 'date_updated_desc' : 'date_added_desc',
    slugs,
    ids,
  });
  const products = rows.map(toTorob);
  return NextResponse.json(
    { api_version: 'torob_api_v3', current_page: page, total, max_pages: maxPages, products },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600', 'X-Robots-Tag': 'noindex' } }
  );
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return handle({ page: Number(sp.get('page')) || 1, sort: (sp.get('sort') as FeedSort) ?? undefined });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return handle({
    page: Number(body.page) || 1,
    sort: body.sort as FeedSort,
    page_urls: Array.isArray(body.page_urls) ? (body.page_urls as string[]) : undefined,
    page_uniques: Array.isArray(body.page_uniques) ? (body.page_uniques as string[]).map(String) : undefined,
  });
}
