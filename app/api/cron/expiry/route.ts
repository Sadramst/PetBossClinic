import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { syncProductStock } from '@/lib/shop/stock-sync';
import { productPath } from '@/lib/shop/urls';
import { getExpiryConfig } from '@/lib/shop/expiry-config';
import { buildDigest, digestText } from '@/lib/shop/expiry-digest-core';
import { notifyStaff } from '@/lib/crm/notify';
import { enqueueMessage } from '@/lib/club/messaging/outbox';

export const dynamic = 'force-dynamic';

/**
 * Daily job (Vercel Cron, see vercel.json): batches that expired since yesterday stop
 * counting as stock, so products whose only remaining units are expired go out of stock.
 * Then builds the expiry digest: a bell notification (and SMS to the configured phones),
 * once per day, when anything is expired or critical. Vercel sends
 * `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
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

  let digestSent = false;
  try {
    const [cfg, rows, cfgRow] = await Promise.all([
      getExpiryConfig(),
      db.inventory.findMany({
        where: { quantity: { gt: 0 }, product: { deletedAt: null, tracksExpiry: true } },
        select: { quantity: true, expiryDate: true, product: { select: { nameFa: true } } },
      }),
      db.expiryConfig.findUnique({ where: { id: 'default' }, select: { digestPhones: true } }).catch(() => null),
    ]);
    const digest = buildDigest(
      rows.map((r) => ({ productName: r.product.nameFa, quantity: r.quantity, expiryDate: r.expiryDate })),
      cfg
    );
    if (digest.shouldNotify) {
      const day = new Date().toISOString().slice(0, 10);
      const { title, body } = digestText(digest);
      await notifyStaff({
        kind: 'EXPIRY_DIGEST',
        title,
        body,
        href: '/admin/inventory?state=critical',
        minRole: 'EDITOR',
        dedupeKey: `expiry-digest:${day}`,
      });
      for (const phone of cfgRow?.digestPhones ?? []) {
        await enqueueMessage({ phone, kind: 'system', body: `پت‌باس: ${title}`, dedupeKey: `expiry-digest:${day}:${phone}` }).catch(() => null);
      }
      digestSent = true;
    }
  } catch (err) {
    console.error('expiry digest failed', (err as Error)?.name);
  }

  return NextResponse.json({ checked: products.length, changed: changed.length, digest: digestSent });
}
