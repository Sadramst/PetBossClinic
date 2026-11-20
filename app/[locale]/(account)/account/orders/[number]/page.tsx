import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { db } from '@/lib/db';
import { AccountShell } from '@/components/account/account-shell';
import { RetryPayment } from '@/components/account/retry-payment';
import { ClearCartOnSuccess } from '@/components/shop/clear-cart';
import { requireCustomer } from '@/lib/customer/session';
import { formatPrice } from '@/lib/format/price';
import { formatJalaliDate } from '@/lib/shop/expiry';
import { lineExpiryText as lineExpiry } from '@/lib/shop/order-expiry';
import { ORDER_STATUS_FA } from '@/lib/shop/orders';
import { productPath } from '@/lib/shop/urls';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'جزئیات سفارش' };

const STEPS = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; number: string }>;
  searchParams: Promise<{ payment?: string; placed?: string }>;
}) {
  const { locale, number } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const customer = await requireCustomer(`/account/orders/${number}`);

  const order = await db.order.findFirst({
    where: { number: decodeURIComponent(number), customerId: customer.id },
    include: { items: true, payments: { select: { status: true, refId: true, authority: true, raw: true }, orderBy: { createdAt: 'desc' } } },
  });
  if (!order) notFound();

  const unpaidOnline = order.paymentMethod === 'ONLINE' && ['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status);
  // The banner (and clearing the cart) must reflect the real order, not just the URL: an old or edited
  // link must not claim success for a cancelled or unpaid order.
  const confirmed = !['PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED'].includes(order.status);
  const success = (sp.payment === 'success' || sp.placed === '1') && confirmed;
  const verifying = sp.payment === 'pending' && order.status === 'PENDING_PAYMENT';
  const paidRef = order.payments.find((p) => p.status === 'PAID')?.refId ?? null;
  // A payment the bank could not confirm yet: the customer can re-check it (verification is idempotent and uses the stored amount).
  const awaiting = order.payments.find(
    (p) => p.status === 'INITIATED' && p.authority && typeof (p.raw as { transientVerifyAt?: string } | null)?.transientVerifyAt === 'string'
  );
  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <AccountShell customer={customer} title={`سفارش ${order.number}`}>
      {success && (
        <ClearCartOnSuccess
          orderNumber={order.number}
          productIds={order.items.flatMap((i) => (i.productId ? [i.productId] : []))}
        />
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          سفارش شما با موفقیت ثبت شد{paidRef ? ` · کد پیگیری پرداخت: ${paidRef}` : ''}. همکاران ما
          به‌زودی آن را آماده و ارسال می‌کنند.
        </div>
      )}
      {sp.payment === 'failed' && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          پرداخت انجام نشد. اگر مبلغی از حساب شما کسر شده، طی ۷۲ ساعت به‌صورت خودکار بازمی‌گردد. می‌توانید دوباره پرداخت کنید.
        </div>
      )}
      {verifying && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-7 text-amber-200">
          تأیید پرداخت شما با تأخیر انجام می‌شود. <b>لطفاً دوباره پرداخت نکنید.</b> اگر مبلغ از حساب شما کسر شده، سفارش تا دقایقی دیگر
          تأیید می‌شود؛ در غیر این صورت با کلینیک تماس بگیرید تا پیگیری کنیم.
          {awaiting?.authority && (
            <a
              href={`/api/payment/zarinpal/callback?Authority=${encodeURIComponent(awaiting.authority)}&Status=OK`}
              className="btn btn-outline btn-sm mt-3 inline-flex"
            >
              بررسی دوباره وضعیت پرداخت
            </a>
          )}
        </div>
      )}
      {sp.payment === 'review' && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          پرداخت شما دریافت شد اما این سفارش قبلاً پرداخت یا لغو شده بود. همکاران ما برای بازگرداندن وجه با شما تماس می‌گیرند.
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface-card p-5 space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span>تاریخ: {formatJalaliDate(order.createdAt)}</span>
          <span>وضعیت: <b>{ORDER_STATUS_FA[order.status]}</b></span>
          <span>پرداخت: {order.paymentMethod === 'COD' ? 'در محل (هنگام تحویل)' : 'آنلاین'}</span>
          {order.trackingCode && <span>کد رهگیری مرسوله: <b dir="ltr">{order.trackingCode}</b></span>}
        </div>
        {stepIndex >= 0 && (
          <ol className="grid grid-cols-4 gap-2 text-[11px] text-center">
            {STEPS.map((s, i) => (
              <li key={s} className={`rounded-lg py-2 border ${i <= stepIndex ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border text-muted-foreground'}`}>
                {ORDER_STATUS_FA[s]}
              </li>
            ))}
          </ol>
        )}
        {unpaidOnline && !verifying && <RetryPayment orderNumber={order.number} />}
      </div>

      <div className="rounded-2xl border border-border bg-surface-card divide-y divide-border">
        {order.items.map((it) => (
          <div key={it.id} className="p-4 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              {it.slugFa ? (
                <Link href={productPath(it.slugFa)} className="font-medium hover:text-primary line-clamp-1">{it.nameFa}</Link>
              ) : (
                <span className="font-medium line-clamp-1">{it.nameFa}</span>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {it.quantity.toLocaleString('fa-IR')} × {formatPrice(it.unitPrice, 'fa')}
              </p>
              {lineExpiry(it.allocations) && (
                <p data-testid="order-line-expiry" className="text-xs text-muted-foreground mt-0.5">
                  تاریخ انقضا: {lineExpiry(it.allocations)}
                </p>
              )}
            </div>
            <span className="font-bold whitespace-nowrap">{formatPrice(it.lineTotal, 'fa')}</span>
          </div>
        ))}
        <dl className="p-4 text-sm space-y-2">
          <Row label="جمع کالاها" value={formatPrice(order.subtotal, 'fa')} />
          {order.discount > 0 && (
            <div data-testid="discount-line">
              <Row label={order.couponCode ? `تخفیف (کد ${order.couponCode})` : 'تخفیف'} value={`−${formatPrice(order.discount, 'fa')}`} />
            </div>
          )}
          <Row label="هزینه ارسال" value={order.shippingFee ? formatPrice(order.shippingFee, 'fa') : 'رایگان'} />
          {order.shippingDiscount > 0 && (
            <div data-testid="shipping-discount-line">
              <Row label={order.couponCode ? `تخفیف ارسال (کد ${order.couponCode})` : 'تخفیف ارسال'} value={`−${formatPrice(order.shippingDiscount, 'fa')}`} />
            </div>
          )}
          <Row label="مبلغ کل" value={formatPrice(order.total, 'fa')} strong />
        </dl>
      </div>

      <div className="rounded-2xl border border-border bg-surface-card p-5 text-sm space-y-1">
        <p className="font-bold mb-2">ارسال به</p>
        <p>{order.shipName} · <span dir="ltr">{order.shipPhone}</span></p>
        <p className="text-muted-foreground leading-7">{order.shipProvince}، {order.shipCity}، {order.shipAddress}</p>
        <p className="text-muted-foreground">کد پستی: <span dir="ltr">{order.shipPostal}</span></p>
      </div>
    </AccountShell>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? 'font-black text-gradient-gold text-base' : ''}>{value}</dd>
    </div>
  );
}
