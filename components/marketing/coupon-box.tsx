'use client';

import { useCallback, useEffect, useState } from 'react';
import { applyCouponAction } from '@/app/actions/marketing';
import type { Quote } from '@/app/actions/checkout';
import { COUPON_KEY, readStore, writeStore } from '@/components/marketing/storage';
import { formatPrice } from '@/lib/format/price';

const NEED_LOGIN = 'وارد حساب شوید';

/**
 * The typed coupon code, kept in localStorage so it survives reloads and the login redirect.
 * The server re-validates it on every quote: the stored value is only a hint.
 */
export function useCouponCode(quote: Quote | null) {
  const [code, setCodeState] = useState('');
  const [codeReady, setCodeReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setCodeState(readStore(COUPON_KEY) ?? '');
    setCodeReady(true);
  }, []);

  const setCode = useCallback((next: string) => {
    setCodeState(next);
    setNotice(null);
    writeStore(COUPON_KEY, next || null);
  }, []);

  // A stored code that no longer works (expired, used up) is dropped with an explanation;
  // a guest keeps it so it is still there after signing in.
  useEffect(() => {
    if (!quote || !code) return;
    if (quote.couponError) {
      setNotice(quote.couponError);
      if (!quote.couponError.includes(NEED_LOGIN)) {
        setCodeState('');
        writeStore(COUPON_KEY, null);
      }
    } else {
      setNotice(null);
    }
  }, [quote, code]);

  return { code, setCode, codeReady, notice };
}

export function CouponBox({
  quote,
  code,
  setCode,
  notice,
  items,
  province,
  city,
}: {
  quote: Quote | null;
  code: string;
  setCode: (code: string) => void;
  notice: string | null;
  items: { productId: string; quantity: number }[];
  province?: string;
  city?: string;
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const applied = quote?.coupon ?? null;
  const saved = quote ? quote.discount + quote.shippingDiscount : 0;
  const waitingForLogin = !!code && !applied?.code && !!notice && notice.includes(NEED_LOGIN);

  const apply = async () => {
    if (pending) return;
    if (!input.trim()) {
      setError('کد تخفیف را وارد کنید.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await applyCouponAction(input, items, province, city);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCode(res.coupon.code);
      setInput('');
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2" data-testid="coupon-box">
      {applied && (
        <div data-testid="coupon-applied" className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5" role="status">
          <div className="min-w-0 space-y-0.5">
            <p className="clamp-2 text-sm font-bold text-primary">{applied.title}</p>
            <p className="text-xs text-muted-foreground">
              <span dir="ltr" className="font-bold">
                {applied.code}
              </span>
              {applied.auto ? ' · اعمال خودکار' : ''}
              {saved > 0 ? ` · ${formatPrice(saved, 'fa')} صرفه‌جویی` : ''}
            </p>
          </div>
          {!applied.auto && (
            <button type="button" data-testid="coupon-remove" onClick={() => setCode('')} className="btn btn-ghost btn-sm shrink-0" aria-label="حذف کد تخفیف">
              حذف
            </button>
          )}
        </div>
      )}
      {/* An automatic discount does not hide the box: a typed code replaces it when it saves more or equal. */}
      {(!applied || applied.auto) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          className="space-y-2"
        >
          <label htmlFor="coupon-input" className="text-xs font-bold">
            کد تخفیف دارید؟
          </label>
          <div className="flex gap-2">
            <input
              id="coupon-input"
              data-testid="coupon-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              dir="ltr"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="PB-XXXX-XXXX"
              aria-invalid={!!error}
              aria-describedby={error ? 'coupon-error' : undefined}
              className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-input px-3 text-start text-sm uppercase placeholder:normal-case"
            />
            <button type="submit" data-testid="coupon-apply" disabled={pending} className="btn btn-outline h-11 shrink-0">
              {pending ? '…' : 'اعمال'}
            </button>
          </div>
        </form>
      )}
      {error && (!applied || applied.auto) && (
        <p id="coupon-error" role="alert" className="text-xs leading-6 text-red-400">
          {error}
        </p>
      )}
      {!error && notice && (
        <p role="status" className="text-xs leading-6 text-amber-400">
          {waitingForLogin ? `کد ${code} نگه داشته شد. ${notice}` : notice}
        </p>
      )}
    </div>
  );
}

/** Discount rows shared by the cart and checkout summaries. */
export function DiscountLines({ quote }: { quote: Quote | null }) {
  if (!quote) return null;
  return (
    <>
      {quote.discount > 0 && (
        <div data-testid="discount-line" className="flex items-center justify-between gap-3 text-emerald-400">
          <dt>تخفیف{quote.coupon ? ` (${quote.coupon.title})` : ''}</dt>
          <dd className="whitespace-nowrap font-bold">−{formatPrice(quote.discount, 'fa')}</dd>
        </div>
      )}
      {quote.shippingDiscount > 0 && (
        <div data-testid="shipping-discount-line" className="flex items-center justify-between gap-3 text-emerald-400">
          <dt>تخفیف هزینه ارسال</dt>
          <dd className="whitespace-nowrap font-bold">−{formatPrice(quote.shippingDiscount, 'fa')}</dd>
        </div>
      )}
    </>
  );
}
