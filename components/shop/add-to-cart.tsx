'use client';

import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { useCart } from '@/components/shop/cart-provider';
import type { CartLine } from '@/lib/shop/cart-types';

/** Quantity stepper + "add to cart". After adding, offers to go to the cart. */
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
  const inCart = lines.find((l) => l.productId === product.productId)?.quantity ?? 0;
  const max = Math.max(1, Math.min(20, maxQuantity ?? 20));

  const onAdd = () => {
    add(product, qty);
    setAdded(true);
  };

  if (compact) {
    return (
      <button type="button" onClick={onAdd} className="shrink-0 h-11 px-5 inline-flex items-center rounded-xl bg-gradient-gold text-charcoal-950 font-extrabold text-sm">
        {added ? '✓ افزوده شد' : 'افزودن به سبد'}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex items-center rounded-xl border border-border bg-surface" role="group" aria-label="تعداد">
          <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} className="w-10 h-12 text-lg" aria-label="افزایش تعداد">
            +
          </button>
          <span className="w-8 text-center font-bold" aria-live="polite">
            {qty.toLocaleString('fa-IR')}
          </span>
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-12 text-lg" aria-label="کاهش تعداد">
            −
          </button>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex-1 h-12 rounded-xl bg-gradient-gold text-charcoal-950 font-extrabold text-sm shadow-gold hover:opacity-90"
        >
          افزودن به سبد خرید
        </button>
      </div>
      {(added || inCart > 0) && (
        <p className="text-xs text-emerald-400 flex items-center justify-between">
          <span>{inCart.toLocaleString('fa-IR')} عدد از این کالا در سبد شماست.</span>
          <Link href="/cart" className="font-bold text-primary hover:underline">
            مشاهده سبد و تکمیل خرید ←
          </Link>
        </p>
      )}
    </div>
  );
}

/** Cart icon with item count for the header. */
export function CartIconLink({ className = '' }: { className?: string }) {
  const { count, ready } = useCart();
  return (
    <Link href="/cart" className={`relative p-2.5 rounded-xl border border-border hover:border-primary hover:text-primary ${className}`} aria-label={`سبد خرید، ${count} کالا`}>
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {ready && count > 0 && (
        <span className="absolute -top-1.5 -start-1.5 min-w-5 h-5 px-1 rounded-full bg-primary text-charcoal-950 text-[11px] font-black flex items-center justify-center">
          {count.toLocaleString('fa-IR')}
        </span>
      )}
    </Link>
  );
}
