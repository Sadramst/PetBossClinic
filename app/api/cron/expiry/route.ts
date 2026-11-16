import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { syncProductStock } from '@/lib/shop/stock-sync';
import { productPath } from '@/lib/shop/urls';

export const dynamic = 'force-dynamic';

/**
 * Daily job (Vercel Cron, see vercel.json): batches that expired since yesterday stop
 * counting as stock, so products whose only remaining units are expired go out of stock.
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const products = await db.product.findMany({
    where: { deletedAt: null, inventory: { some: {} } },
    select: { id: true },
  });

  const changed: string[] = [];
  for (const p of products) {
    const slug = await syncProductStock(p.id);
    if (slug) changed.push(slug);
  }
  for (const slug of changed) revalidatePath(productPath(slug));
  if (changed.length) revalidatePath('/shop');

  return NextResponse.json({ checked: products.length, changed: changed.length });
}
