'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useCart } from '@/components/shop/cart-provider';
import { quoteAction, type Quote } from '@/app/actions/checkout';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { formatPrice } from '@/lib/format/price';
import { MAX_QTY_PER_LINE, type CartLine } from '@/lib/shop/cart-types';
import { productPath } from '@/lib/shop/urls';
import { CouponBox, DiscountLines, useCouponCode } from '@/components/marketing/coupon-box';

const fa = (n: number) => n.toLocaleString('fa-IR');

const CartIcon = (
  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2" />
    <circle cx="9.5" cy="19.5" r="1.3" />
    <circle cx="17" cy="19.5" r="1.3" />
  </svg>
);

function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]" aria-busy="true">
      <span className="sr-only" role="status">
        در حال بارگذاری سبد خرید…
      </span>
      <div className="surface-card divide-y divide-border">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4 p-4">
            <Skeleton className="h-20 w-20 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        ))}
      </div>
      <div className="surface-card h-fit space-y-4 p-5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function CartView({
  loggedIn,
  onlineCheckout = true,
  whatsappNumber,
  phoneLink,
}: {
  loggedIn: boolean;
  /** False until SMS login is configured: orders go by WhatsApp/phone instead. */
  onlineCheckout?: boolean;
  whatsappNumber?: string | null;
  phoneLink?: string;
}) {
  const cart = useCart();
  const { lines, ready, setQuantity, remove } = cart;
  // Toast callbacks outlive the render that created them: always reach the latest cart.
  const cartRef = useRef(cart);
  cartRef.current = cart;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const { code, setCode, codeReady, notice } = useCouponCode(quote);

  // Re-price from the server whenever the cart (or the coupon) changes.
  const key = `${lines.map((l) => `${l.productId}:${l.quantity}`).join(',')}|${code}`;
  useEffect(() => {
    if (!ready || !codeReady) return;
    let alive = true;
    quoteAction(
      lines.map(({ productId, quantity }) => ({ productId, quantity })),
      undefined,
      undefined,
      code || undefined
    )
      .then((q) => {
        if (!alive) return;
        setQuote(q);
        setQuoteFailed(false);
      })
      .catch(() => alive && setQuoteFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, codeReady, key, attempt]);

  if (!ready) return <CartSkeleton />;

  if (lines.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={CartIcon}
        title="سبد خرید شما خالی است."
        description="غذا، تشویقی و لوازم حیوان خانگی‌تان را از پت‌شاپ پت‌باس انتخاب کنید؛ همه اقلام زیر نظر دامپزشک تأمین می‌شوند."
        action={
          <Link href="/shop" className="btn btn-gold">
            مشاهده محصولات
          </Link>
        }
        secondaryAction={
          <Link href="/services" className="btn btn-outline">
            خدمات کلینیک
          </Link>
        }
      />
    );
  }

  const removeLine = (line: CartLine) => {
    remove(line.productId);
    toast({
      title: 'از سبد خرید حذف شد',
      description: (
        <button
          type="button"
          className="font-bold text-primary underline underline-offset-4"
          onClick={() => {
            const { quantity, ...rest } = line;
            if (!cartRef.current.lines.some((l) => l.productId === line.productId)) cartRef.current.add(rest, quantity);
          }}
        >
          بازگردانی «{line.name}»
        </button>
      ),
      duration: 7000,
    });
  };

  const priced = new Map(quote?.lines.map((l) => [l.productId, l]));
  const hasProblems = quote?.lines.some((l) => l.problem) ?? false;
  const blocked = hasProblems || !quote;
  const freeOver = quote?.freeShippingOver ?? 0;
  const remainingForFree = quote ? freeOver - quote.subtotal : 0;
  const freeProgress = quote && freeOver > 0 ? Math.min(100, Math.round((quote.subtotal / freeOver) * 100)) : 0;
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);

  const checkoutHref = loggedIn ? '/checkout' : '/account/login?next=/checkout';
  const checkoutLabel = loggedIn ? 'ادامه و انتخاب نشانی' : 'ورود و ادامه خرید';
  const whatsappHref =
    whatsappNumber && quote
      ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
          [
            'سلام، می‌خواهم این سفارش را از سایت پت‌باس ثبت کنم:',
            ...quote.lines.filter((l) => !l.problem).map((l) => `- ${l.nameFa}${l.sku ? ` (کد ${l.sku})` : ''} × ${l.quantity}`),
            `جمع کالاها: ${formatPrice(quote.subtotal, 'fa')}`,
          ].join('\n')
        )}`
      : null;

  /** The main call to action; rendered once in the summary (desktop) and once in the sticky bar (mobile). */
  const cta = (className: string) =>
    onlineCheckout ? (
      blocked ? (
        <button type="button" disabled className={`btn btn-gold ${className}`}>
          {checkoutLabel}
        </button>
      ) : (
        <Link href={checkoutHref} className={`btn btn-gold ${className}`}>
          {checkoutLabel}
        </Link>
      )
    ) : whatsappHref ? (
      <a href={whatsappHref} target="_blank" rel="noopener" className={`btn btn-gold ${className}`}>
        ثبت سفارش در واتس‌اپ
      </a>
    ) : phoneLink ? (
      <a href={phoneLink} className={`btn btn-gold ${className}`}>
        ثبت سفارش تلفنی
      </a>
    ) : null;

  return (
    <div className="grid grid-cols-1 gap-6 pb-24 lg:grid-cols-[1fr_340px] lg:pb-0">
      <div className="min-w-0 space-y-3">
        {quoteFailed && (
          <Alert
            tone="error"
            title="به‌روزرسانی قیمت‌ها انجام نشد"
            action={
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setAttempt((n) => n + 1)}>
                تلاش دوباره
              </button>
            }
          >
            اتصال اینترنت خود را بررسی کنید.
          </Alert>
        )}
        <ul className="surface-card divide-y divide-border" aria-label="اقلام سبد خرید">
          {lines.map((l) => {
            const p = priced.get(l.productId);
            const gone = !!p && !p.slugFa;
            const name = gone ? l.name : p?.nameFa ?? l.name;
            const price = p && !gone ? p.unitPrice : l.price;
            const stockMax = p?.available != null && p.available > 0 ? p.available : MAX_QTY_PER_LINE;
            const max = Math.min(MAX_QTY_PER_LINE, stockMax);
            const overStock = !!p && p.available != null && p.available > 0 && l.quantity > p.available;
            const atLimit = !p?.problem && l.quantity >= max;
            return (
              <li key={l.productId} className="flex gap-3 p-4 sm:gap-4">
                <Link
                  href={productPath(l.slug)}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-surface sm:h-24 sm:w-24"
                  tabIndex={-1}
                  aria-hidden
                >
                  <Image src={(!gone && p?.image) || l.image} alt="" fill sizes="96px" className={`object-cover ${p?.problem && !overStock ? 'opacity-50 grayscale' : ''}`} />
                </Link>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={productPath(l.slug)} className="clamp-2 text-sm font-bold leading-6 hover:text-primary">
                      {name}
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeLine(l)}
                      aria-label={`حذف ${name} از سبد`}
                      className="-me-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
                      </svg>
                    </button>
                  </div>

                  {l.quantity > 1 && !gone && <p className="text-xs text-muted-foreground">قیمت واحد: {formatPrice(price, 'fa')}</p>}
                  {p && !p.problem && p.unitPrice !== l.price && <p className="text-xs text-amber-400">قیمت این کالا به‌روز شده است.</p>}

                  {p?.problem && (
                    <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5" role="alert">
                      <p className="text-xs font-bold text-red-300">{p.problem}</p>
                      {overStock ? (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setQuantity(l.productId, p.available!)}>
                          تعداد را به {fa(p.available!)} کاهش بده
                        </button>
                      ) : (
                        <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => removeLine(l)}>
                          حذف از سبد
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <QuantityStepper
                      value={l.quantity}
                      max={max}
                      label={`تعداد ${name}`}
                      onChange={(q) => setQuantity(l.productId, q)}
                      onRemove={() => removeLine(l)}
                    />
                    <span className={`text-sm font-extrabold ${p?.problem && !overStock ? 'text-muted-foreground line-through' : ''}`}>
                      {formatPrice(price * l.quantity, 'fa')}
                    </span>
                  </div>
                  {atLimit && (
                    <p className="text-[11px] text-muted-foreground">
                      {max < MAX_QTY_PER_LINE ? `بیشترین موجودی این کالا ${fa(max)} عدد است.` : `از هر کالا حداکثر ${fa(MAX_QTY_PER_LINE)} عدد می‌توانید سفارش دهید.`}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <Link href="/shop" className="btn btn-ghost btn-sm">
          <svg className="rtl-flip h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          ادامه خرید از پت‌شاپ
        </Link>
      </div>

      <aside className="surface-card top-header h-fit space-y-4 p-5 lg:sticky" aria-label="خلاصه سبد خرید" aria-busy={!quote}>
        <h2 className="font-extrabold">خلاصه سبد</h2>
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">جمع کالاها ({fa(itemCount)} عدد)</dt>
            <dd className="font-extrabold">{quote ? formatPrice(quote.subtotal, 'fa') : <Skeleton className="h-4 w-24" />}</dd>
          </div>
          <DiscountLines quote={quote} />
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">هزینه ارسال</dt>
            <dd className="text-xs text-muted-foreground">
              {quote?.coupon?.type === 'FREE_SHIPPING' ? 'رایگان با کد تخفیف' : 'در مرحله بعد محاسبه می‌شود'}
            </dd>
          </div>
          {quote && (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
              <dt className="font-bold">مبلغ کالاها پس از تخفیف</dt>
              <dd data-testid="cart-total" className="text-gradient-gold font-black">
                {formatPrice(Math.max(0, quote.subtotal - quote.discount), 'fa')}
              </dd>
            </div>
          )}
        </dl>

        <CouponBox
          quote={quote}
          code={code}
          setCode={setCode}
          notice={notice}
          items={lines.map(({ productId, quantity }) => ({ productId, quantity }))}
        />

        {quote && freeOver > 0 && quote.subtotal > 0 && (
          <div className="space-y-2 rounded-xl bg-primary/10 px-3 py-2.5">
            <p className="text-xs leading-6 text-primary">
              {remainingForFree > 0
                ? `با ${formatPrice(remainingForFree, 'fa')} خرید بیشتر، ارسال رایگان می‌شود.`
                : 'ارسال رایگان شامل این سفارش می‌شود.'}
            </p>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={freeProgress}
              aria-label="پیشرفت تا ارسال رایگان"
            >
              <div className="h-full rounded-full bg-gradient-gold transition-[width] duration-300" style={{ width: `${freeProgress}%` }} />
            </div>
          </div>
        )}

        {hasProblems && (
          <p className="text-xs leading-6 text-red-400" role="alert">
            برای ادامه، اقلام مشکل‌دار را اصلاح یا حذف کنید.
          </p>
        )}

        <div className="hidden lg:block">{cta('btn-lg btn-block')}</div>

        {!onlineCheckout && (
          <div className="space-y-2">
            {whatsappHref && phoneLink && (
              <a href={phoneLink} className="btn btn-outline btn-block">
                ثبت سفارش تلفنی
              </a>
            )}
            <p className="text-[11px] leading-6 text-muted-foreground">پرداخت آنلاین به‌زودی فعال می‌شود.</p>
          </div>
        )}
        <p className="text-[11px] leading-6 text-muted-foreground">تاریخ انقضا بعد از تأیید سفارش در فاکتور درج می‌شود و پیش از ارسال توسط دامپزشک کنترل می‌شود.</p>
      </aside>

      {/* Mobile: total and the main action stay in reach above the bottom navigation. */}
      <div className="bottom-above-nav fixed inset-x-0 z-40 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden print:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 shrink-0">
            <p className="text-[11px] text-muted-foreground">{quote && quote.discount > 0 ? 'پس از تخفیف' : 'جمع کالاها'}</p>
            <p className="text-gradient-gold text-sm font-black">{quote ? formatPrice(Math.max(0, quote.subtotal - quote.discount), 'fa') : '…'}</p>
          </div>
          <div className="min-w-0 flex-1">{cta('btn-block')}</div>
        </div>
      </div>
    </div>
  );
}
