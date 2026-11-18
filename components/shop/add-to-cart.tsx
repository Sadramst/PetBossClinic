'use client';

import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useCart } from '@/components/shop/cart-provider';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { toast } from '@/components/ui/toaster';
import { MAX_LINES, MAX_QTY_PER_LINE, type CartLine } from '@/lib/shop/cart-types';

const fa = (n: number) => n.toLocaleString('fa-IR');

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/**
 * Quantity stepper + "add to cart". Knows what is already in the cart, so the
 * customer can never put more than the sellable stock (or the per-line cap) in it.
 * `compact` is the one-tap version used in the sticky mobile buy bar.
 */
export function AddToCart({
  product,
  maxQuantity,
  compact = false,
}: {
  product: Omit<CartLine, 'quantity'>;
  maxQuantity?: number | null;
  compact?: boolean;
}) {
  const { add, lines } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const line = lines.find((l) => l.productId === product.productId);
  const inCart = line?.quantity ?? 0;
  const max = Math.max(1, Math.min(MAX_QTY_PER_LINE, maxQuantity ?? MAX_QTY_PER_LINE));
  const remaining = Math.max(0, max - inCart);
  const full = remaining <= 0;
  const cartFull = !line && lines.length >= MAX_LINES;
  const amount = Math.min(qty, Math.max(1, remaining));

  const addNow = (count: number) => {
    if (full) return;
    if (cartFull) {
      toast.error('سبد خرید پر است', 'برای افزودن این کالا، ابتدا یکی از کالاهای سبد را حذف کنید.');
      return;
    }
    const n = Math.max(1, Math.min(count, remaining));
    add(product, n);
    setQty(1);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 2500);
    toast.success('به سبد خرید اضافه شد', `${fa(n)} عدد ${product.name}`);
  };

  if (compact) {
    if (inCart > 0) {
      return (
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/cart" className="btn btn-gold px-4">
            مشاهده سبد ({fa(inCart)})
          </Link>
          <button
            type="button"
            onClick={() => addNow(1)}
            disabled={full}
            aria-label="افزودن یک عدد دیگر"
            title={full ? 'حداکثر موجودی در سبد شماست' : 'افزودن یک عدد دیگر'}
            className="btn btn-outline btn-icon disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      );
    }
    return (
      <button type="button" onClick={() => addNow(1)} className="btn btn-gold shrink-0 px-5">
        افزودن به سبد
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <QuantityStepper
          value={amount}
          onChange={setQty}
          max={Math.max(1, remaining)}
          disabled={full}
          label="تعداد"
          className="h-12 shrink-0"
        />
        <button
          type="button"
          onClick={() => addNow(amount)}
          disabled={full}
          className="btn btn-gold btn-lg min-w-0 flex-1 px-3 disabled:opacity-60"
        >
          {full ? (
            'حداکثر موجودی در سبد شماست'
          ) : added ? (
            <>
              <CheckIcon />
              به سبد اضافه شد
            </>
          ) : (
            'افزودن به سبد خرید'
          )}
        </button>
      </div>

      {!full && amount >= remaining && remaining < MAX_QTY_PER_LINE && (
        <p className="field-hint">
          {inCart > 0
            ? `حداکثر ${fa(remaining)} عدد دیگر می‌توانید اضافه کنید.`
            : `حداکثر ${fa(remaining)} عدد قابل سفارش است.`}
        </p>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {added ? `به سبد خرید اضافه شد. ${fa(inCart)} عدد از این کالا در سبد شماست.` : ''}
      </p>

      {inCart > 0 && (
        <div className="animate-fade-in flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <span className="flex items-center gap-2 text-sm font-bold text-emerald-300">
            <CheckIcon />
            {fa(inCart)} عدد در سبد شماست
          </span>
          <Link href="/cart" className="btn btn-gold btn-sm">
            تکمیل خرید
          </Link>
        </div>
      )}
    </div>
  );
}

/** Cart icon with item count for the header. */
export function CartIconLink({ className = '' }: { className?: string }) {
  const { count, ready } = useCart();
  const shown = ready ? count : 0;
  return (
    <Link
      href="/cart"
      className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border transition-colors hover:border-primary hover:text-primary ${className}`}
      aria-label={`سبد خرید، ${fa(shown)} کالا`}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {shown > 0 && (
        // Re-keyed on every change so the badge replays its short entrance animation.
        <span
          key={shown}
          className="animate-rise-in absolute -top-1.5 -start-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-black leading-none text-charcoal-950"
          aria-hidden
        >
          {fa(shown)}
        </span>
      )}
    </Link>
  );
}
