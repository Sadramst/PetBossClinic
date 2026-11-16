import { NextRequest, NextResponse } from 'next/server';
import sitemap from '@/app/sitemap';
import { INDEXNOW_ENDPOINT, INDEXNOW_HOST, INDEXNOW_KEY, INDEXNOW_KEY_LOCATION } from '@/lib/seo/indexnow';

export const dynamic = 'force-dynamic';

/**
 * Submit the current sitemap to IndexNow. Protected by CRON_SECRET so it can be
 * called from Vercel Cron (/api/indexnow) or manually:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://www.petbossclinic.com/api/indexnow
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url).slice(0, 10000);
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: INDEXNOW_HOST, key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION, urlList: urls }),
    });
    return NextResponse.json({ submitted: urls.length, indexNowStatus: res.status });
  } catch (err) {
    console.error('indexnow submission failed', err);
    return NextResponse.json({ error: 'submission failed' }, { status: 500 });
  }
}
