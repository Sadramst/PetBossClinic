import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { verifyPayment } from '@/lib/payments/zarinpal';
import { allocateOrderStock } from '@/lib/shop/orders';

export const dynamic = 'force-dynamic';

/**
 * ZarinPal redirects the customer here after the bank page:
 *   ?Authority=...&Status=OK|NOK
 * The payment is only trusted after server-side verification with the exact amount.
 */
export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get('Authority') ?? '';
  const status = req.nextUrl.searchParams.get('Status');
  const back = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);

  const payment = authority
    ? await db.payment.findUnique({ where: { authority }, include: { order: { select: { id: true, number: true, status: true } } } })
    : null;
  if (!payment) return back('/account');

  const orderPage = `/account/orders/${payment.order.number}`;
  if (payment.status === 'PAID') return back(`${orderPage}?payment=success`);

  if (status !== 'OK') {
    await db.$transaction([
      db.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } }),
      db.order.updateMany({ where: { id: payment.orderId, status: 'PENDING_PAYMENT' }, data: { status: 'PAYMENT_FAILED' } }),
    ]);
    return back(`${orderPage}?payment=failed`);
  }

  const result = await verifyPayment(authority, payment.amountRial);
  if (!result.ok) {
    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', raw: (result.raw ?? undefined) as Prisma.InputJsonValue | undefined },
      }),
      db.order.updateMany({ where: { id: payment.orderId, status: 'PENDING_PAYMENT' }, data: { status: 'PAYMENT_FAILED' } }),
    ]);
    return back(`${orderPage}?payment=failed`);
  }

  const now = new Date();
  await db.$transaction([
    db.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        refId: result.refId,
        cardPan: result.cardPan,
        verifiedAt: now,
        raw: result.raw as Prisma.InputJsonValue,
      },
    }),
    db.order.updateMany({
      where: { id: payment.orderId, status: { in: ['PENDING_PAYMENT', 'PAYMENT_FAILED'] } },
      data: { status: 'CONFIRMED', paidAt: now },
    }),
  ]);
  await allocateOrderStock(payment.orderId);
  return back(`${orderPage}?payment=success`);
}
