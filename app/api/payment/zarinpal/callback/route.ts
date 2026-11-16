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
 * Every state change is a conditional update, so refreshes, back-button replays and
 * parallel requests can never confirm an order twice or take its stock twice.
 */
export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get('Authority') ?? '';
  const status = req.nextUrl.searchParams.get('Status');
  const back = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);

  const payment = authority
    ? await db.payment.findUnique({ where: { authority }, include: { order: { select: { id: true, number: true } } } })
    : null;
  if (!payment) return back('/account');

  const orderPage = `/account/orders/${payment.order.number}`;
  if (payment.status === 'PAID') return back(`${orderPage}?payment=success`);

  const markFailed = async (raw?: unknown) => {
    await db.$transaction([
      db.payment.updateMany({
        where: { id: payment.id, status: { not: 'PAID' } },
        data: { status: 'FAILED', ...(raw ? { raw: raw as Prisma.InputJsonValue } : {}) },
      }),
      db.order.updateMany({ where: { id: payment.orderId, status: 'PENDING_PAYMENT' }, data: { status: 'PAYMENT_FAILED' } }),
    ]);
    return back(`${orderPage}?payment=failed`);
  };

  if (status !== 'OK') return markFailed();

  const result = await verifyPayment(authority, payment.amountRial);
  if (!result.ok) return markFailed(result.raw ?? undefined);

  const now = new Date();
  // Claim this payment: only the first request that gets here continues.
  const claimed = await db.payment.updateMany({
    where: { id: payment.id, status: { not: 'PAID' } },
    data: { status: 'PAID', refId: result.refId, cardPan: result.cardPan, verifiedAt: now, raw: result.raw as Prisma.InputJsonValue },
  });
  if (claimed.count === 0) return back(`${orderPage}?payment=success`);

  const confirmed = await db.order.updateMany({
    where: { id: payment.orderId, status: { in: ['PENDING_PAYMENT', 'PAYMENT_FAILED'] } },
    data: { status: 'CONFIRMED', paidAt: now },
  });

  if (confirmed.count === 0) {
    // Money arrived for an order that was cancelled or already paid through another
    // payment attempt: keep the order as is and flag it so the shop refunds.
    const order = await db.order.findUnique({ where: { id: payment.orderId }, select: { adminNote: true } });
    const note = `⚠ پرداخت اضافه/پس از لغو (کد پیگیری ${result.refId ?? '-'}): نیاز به بازگشت وجه`;
    await db.order.update({
      where: { id: payment.orderId },
      data: { adminNote: order?.adminNote ? `${order.adminNote}\n${note}` : note },
    });
    return back(`${orderPage}?payment=review`);
  }

  await allocateOrderStock(payment.orderId);
  return back(`${orderPage}?payment=success`);
}
