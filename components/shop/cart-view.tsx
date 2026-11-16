'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useCart } from '@/components/shop/cart-provider';
import { quoteAction, type Quote } from '@/app/actions/checkout';
import { formatPrice } from '@/lib/format/price';
import { productPath } from '@/lib/shop/urls';

export function CartView({ loggedIn }: { loggedIn: boolean }) {
  const { lines, ready, setQuantity, remove } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);

  // Re-price from the server whenever the cart changes.
  const key = lines.map((l) => `${l.productId}:${l.quantity}`).join(',');
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    quoteAction(lines.map(({ productId, quantity }) => ({ productId, quantity }))).then((q) => alive && setQuote(q));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  if (!ready) return <p className="text-sm text-muted-foreground">در حال بارگذاری سبد…</p>;

  if (lines.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-surface-card p-12 text-center space-y-4">
        <p className="text-lg font-bold">سبد خرید شما خالی است.</p>
        <Link href="/shop" className="inline-block h-11 px-6 leading-[2.75rem] rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-sm">
          مشاهده محصولات
        </Link>
      </div>
    );
  }

  const priced = new Map(quote?.lines.map((l) => [l.productId, l]));
  const hasProblems = quote?.lines.some((l) => l.problem) ?? false;
  const remainingForFree = quote ? quote.freeShippingOver - quote.subtotal : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <ul className="rounded-2xl border border-border bg-surface-card divide-y divide-border">
        {lines.map((l) => {
          const p = priced.get(l.productId);
          const price = p?.unitPrice ?? l.price;
          return (
            <li key={l.productId} className="p-4 flex gap-4">
              <Link href={productPath(l.slug)} className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-border">
                <Image src={p?.image ?? l.image} alt={l.name} fill sizes="80px" className="object-cover" />
              </Link>
              <div className="flex-1 min-w-0 space-y-2">
                <Link href={productPath(l.slug)} className="text-sm font-bold line-clamp-2 hover:text-primary">
                  {p?.nameFa ?? l.name}
                </Link>
                {p?.problem && <p className="text-xs text-red-400">{p.problem}</p>}
                {p && p.unitPrice !== l.price && !p.problem && (
                  <p className="text-xs text-amber-400">قیمت این کالا به‌روز شده است.</p>
                )}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-lg border border-border">
                    <button className="w-8 h-8" onClick={() => setQuantity(l.productId, l.quantity + 1)} aria-label="افزایش">+</button>
                    <span className="w-7 text-center text-sm font-bold">{l.quantity.toLocaleString('fa-IR')}</span>
                    <button
                      className="w-8 h-8"
                      onClick={() => (l.quantity > 1 ? setQuantity(l.productId, l.quantity - 1) : remove(l.productId))}
                      aria-label="کاهش"
                    >
                      −
                    </button>
                  </div>
                  <span className="text-sm font-bold">{formatPrice(price * l.quantity, 'fa')}</span>
                </div>
                <button onClick={() => remove(l.productId)} className="text-xs text-muted-foreground hover:text-red-400">
                  حذف از سبد
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="rounded-2xl border border-border bg-surface-card p-5 space-y-4 h-fit lg:sticky lg:top-40">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">جمع کالاها</dt>
            <dd className="font-bold">{quote ? formatPrice(quote.subtotal, 'fa') : '…'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">هزینه ارسال</dt>
            <dd className="text-xs text-muted-foreground">در مرحله بعد محاسبه می‌شود</dd>
          </div>
        </dl>
        {quote && remainingForFree > 0 && (
          <p className="text-xs rounded-xl bg-primary/10 text-primary px-3 py-2">
            با {formatPrice(remainingForFree, 'fa')} خرید بیشتر، ارسال رایگان می‌شود.
          </p>
        )}
        {hasProblems && <p className="text-xs text-red-400">لطفاً اقلام ناموجود را از سبد حذف کنید.</p>}
        <Link
          href={loggedIn ? '/checkout' : '/account/login?next=/checkout'}
          aria-disabled={hasProblems || !quote}
          className={`block text-center h-12 leading-[3rem] rounded-xl bg-gradient-gold text-charcoal-950 font-extrabold ${
            hasProblems || !quote ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {loggedIn ? 'ادامه و انتخاب نشانی' : 'ورود و ادامه خرید'}
        </Link>
        <p className="text-[11px] text-muted-foreground leading-6">
          تاریخ انقضای اقلام خوراکی پیش از ارسال توسط دامپزشک کنترل می‌شود.
        </p>
      </aside>
    </div>
  );
}
