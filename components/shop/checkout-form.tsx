'use client';

import { useEffect, useState, useTransition } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useCart } from '@/components/shop/cart-provider';
import { placeOrderAction, quoteAction, type Quote } from '@/app/actions/checkout';
import { AddressForm, formatAddress, type AddressData } from '@/components/account/address-form';
import { formatPrice } from '@/lib/format/price';

export function CheckoutForm({ addresses, recipient }: { addresses: AddressData[]; recipient: { name: string; phone: string } }) {
  const router = useRouter();
  const { lines, ready, clear } = useCart();
  const [addressId, setAddressId] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? '');
  const [adding, setAdding] = useState(addresses.length === 0);
  const [method, setMethod] = useState<'ONLINE' | 'COD'>('ONLINE');
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const address = addresses.find((a) => a.id === addressId);
  const items = lines.map(({ productId, quantity }) => ({ productId, quantity }));
  // Keyed on the province (not just the id): a just-saved address arrives a moment after its id.
  const key = `${address?.province ?? ''}|${lines.map((l) => `${l.productId}:${l.quantity}`).join(',')}`;

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    quoteAction(items, address?.province).then((q) => {
      if (!alive) return;
      setQuote(q);
      // Choose a payment method that is actually available for this address.
      if (!q.onlineAvailable && q.codAllowed) setMethod('COD');
      if (!q.codAllowed) setMethod('ONLINE');
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  if (ready && lines.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-surface-card p-12 text-center space-y-4">
        <p className="font-bold">سبد خرید شما خالی است.</p>
        <Link href="/shop" className="text-primary hover:underline">مشاهده محصولات</Link>
      </div>
    );
  }

  const placeOrder = () =>
    start(async () => {
      setError(null);
      const res = await placeOrderAction({ items, addressId, paymentMethod: method, note });
      if (res.error) {
        setError(res.error);
        if (res.redirectTo) router.push(res.redirectTo);
        return;
      }
      if (res.redirectTo?.startsWith('http')) {
        // Online payment: the cart is cleared after the bank confirms (order page).
        window.location.assign(res.redirectTo);
      } else if (res.redirectTo) {
        clear();
        window.location.assign(res.redirectTo);
      }
    });

  const problems = quote?.lines.filter((l) => l.problem) ?? [];
  const canPay = !!address && !!quote && problems.length === 0 && (method === 'COD' ? quote.codAllowed : quote.onlineAvailable);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        {/* Address */}
        <section className="rounded-2xl border border-border bg-surface-card p-5 space-y-4">
          <h2 className="font-bold">۱. نشانی ارسال</h2>
          {addresses.length > 0 && (
            <ul className="space-y-2">
              {addresses.map((a) => (
                <li key={a.id}>
                  <label className={`flex gap-3 rounded-xl border p-3 cursor-pointer ${addressId === a.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1" />
                    <span className="text-sm leading-7">
                      <b>{a.title || a.recipientName}</b>
                      <br />
                      <span className="text-muted-foreground">{formatAddress(a)}</span>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {a.recipientName} · <span dir="ltr">{a.recipientPhone}</span> · کد پستی <span dir="ltr">{a.postalCode}</span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {adding ? (
            <AddressForm
              defaultRecipient={recipient}
              onSaved={(id) => {
                setAddressId(id);
                setAdding(false);
                router.refresh();
              }}
              onCancel={addresses.length ? () => setAdding(false) : undefined}
            />
          ) : (
            <button onClick={() => setAdding(true)} className="text-sm text-primary font-bold">
              + افزودن نشانی جدید
            </button>
          )}
        </section>

        {/* Payment */}
        <section className="rounded-2xl border border-border bg-surface-card p-5 space-y-3">
          <h2 className="font-bold">۲. روش پرداخت</h2>
          <label className={`flex gap-3 rounded-xl border p-3 ${quote?.onlineAvailable ? 'cursor-pointer' : 'opacity-50'} ${method === 'ONLINE' ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <input type="radio" checked={method === 'ONLINE'} disabled={!quote?.onlineAvailable} onChange={() => setMethod('ONLINE')} />
            <span className="text-sm">
              <b>پرداخت آنلاین</b> (همه کارت‌های بانکی عضو شتاب)
              {!quote?.onlineAvailable && <span className="block text-xs text-muted-foreground">به‌زودی فعال می‌شود</span>}
            </span>
          </label>
          <label className={`flex gap-3 rounded-xl border p-3 ${quote?.codAllowed ? 'cursor-pointer' : 'opacity-50'} ${method === 'COD' ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <input type="radio" checked={method === 'COD'} disabled={!quote?.codAllowed} onChange={() => setMethod('COD')} />
            <span className="text-sm">
              <b>پرداخت در محل</b> (کارتخوان یا نقد هنگام تحویل)
              {!quote?.codAllowed && <span className="block text-xs text-muted-foreground">فقط برای نشانی‌های شهر تهران</span>}
            </span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="توضیحات سفارش (اختیاری)، مثلاً زمان مناسب تحویل"
            className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm"
          />
        </section>
      </div>

      {/* Summary */}
      <aside className="rounded-2xl border border-border bg-surface-card p-5 space-y-4 h-fit lg:sticky lg:top-40">
        <h2 className="font-bold">خلاصه سفارش</h2>
        <ul className="space-y-2 text-sm max-h-60 overflow-y-auto">
          {(quote?.lines ?? []).map((l) => (
            <li key={l.productId} className="flex justify-between gap-3">
              <span className="line-clamp-1">
                {l.quantity.toLocaleString('fa-IR')} × {l.nameFa}
                {l.problem && <span className="block text-xs text-red-400">{l.problem}</span>}
              </span>
              <span className="whitespace-nowrap">{formatPrice(l.lineTotal, 'fa')}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 text-sm border-t border-border pt-3">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">جمع کالاها</dt>
            <dd>{quote ? formatPrice(quote.subtotal, 'fa') : '…'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">ارسال {quote?.shippingMethod ? `(${quote.shippingMethod})` : ''}</dt>
            <dd>{quote?.shippingFee == null ? '—' : quote.shippingFee === 0 ? 'رایگان' : formatPrice(quote.shippingFee, 'fa')}</dd>
          </div>
          <div className="flex justify-between text-base font-black">
            <dt>مبلغ قابل پرداخت</dt>
            <dd className="text-gradient-gold">{quote ? formatPrice(quote.total, 'fa') : '…'}</dd>
          </div>
        </dl>
        {problems.length > 0 && (
          <p className="text-xs text-red-400">
            برخی اقلام مشکل دارند. <Link href="/cart" className="underline">ویرایش سبد</Link>
          </p>
        )}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button
          onClick={placeOrder}
          disabled={!canPay || pending}
          className="w-full h-12 rounded-xl bg-gradient-gold text-charcoal-950 font-extrabold disabled:opacity-50"
        >
          {pending ? 'در حال ثبت…' : method === 'COD' ? 'ثبت نهایی سفارش' : 'پرداخت و ثبت سفارش'}
        </button>
      </aside>
    </div>
  );
}
