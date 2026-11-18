'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useCart } from '@/components/shop/cart-provider';
import { Sheet } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toaster';
import { MAX_LINES, type CartLine } from '@/lib/shop/cart-types';
import { SORT_LABELS, type SortKey } from '@/lib/shop/filters';

/*
 * Client islands of the product listing live together in this file:
 * the sort dropdown, the quick add-to-cart button on cards and the mobile filter sheet.
 */

/** Sort dropdown: navigates to the same listing with a new sort (resets to page 1). */
export function SortSelect({ value, hrefFor }: { value: SortKey; hrefFor: Record<SortKey, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <span className="sr-only whitespace-nowrap text-muted-foreground sm:not-sr-only">مرتب‌سازی:</span>
      <span className="relative block min-w-0">
        <select
          value={value}
          aria-busy={pending || undefined}
          onChange={(e) => {
            const next = hrefFor[e.target.value as SortKey];
            startTransition(() => router.push(next));
          }}
          className={`h-11 w-full max-w-full cursor-pointer appearance-none rounded-xl border border-border bg-input pe-9 ps-3 text-sm font-semibold transition-opacity hover:border-primary/50 ${
            pending ? 'opacity-60' : ''
          }`}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute end-3 top-1/2 flex -translate-y-1/2 text-muted-foreground">
          {pending ? (
            <Spinner size="sm" label="در حال مرتب‌سازی…" className="text-primary" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          )}
        </span>
      </span>
    </label>
  );
}

/** Round 44px add-to-cart button for product cards. Adds one unit and confirms with a toast. */
export function QuickAddButton({ product, className = '' }: { product: Omit<CartLine, 'quantity'>; className?: string }) {
  const { add, lines, ready } = useCart();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(t);
  }, [added]);

  const onClick = () => {
    if (!ready) return;
    const inCart = lines.some((l) => l.productId === product.productId);
    if (!inCart && lines.length >= MAX_LINES) {
      toast.error('سبد خرید پر است', 'برای افزودن کالای جدید، ابتدا سفارش فعلی را ثبت کنید.');
      return;
    }
    add(product, 1);
    setAdded(true);
    toast.success('به سبد خرید اضافه شد', product.name);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`افزودن ${product.name} به سبد خرید`}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-md transition-colors active:scale-95 ${
        added
          ? 'border-primary bg-primary text-charcoal-950'
          : 'border-primary/70 bg-charcoal-950/90 text-primary hover:bg-primary hover:text-charcoal-950'
      } ${className}`}
    >
      {added ? (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 4h2.2l2.3 10.5h9.9L19.5 8H9" />
          <circle cx="9" cy="19" r="1.4" />
          <circle cx="16.5" cy="19" r="1.4" />
          <path d="M14 3.5v5M11.5 6h5" />
        </svg>
      )}
    </button>
  );
}

/**
 * Phone/tablet filter trigger + bottom sheet. The server-rendered GET form is passed
 * as children; the sheet's "apply" button submits it through the `form` attribute.
 */
export function MobileFilterSheet({
  count,
  formId,
  clearHref,
  children,
  className = '',
}: {
  /** Number of active filters, shown as a badge on the trigger. */
  count: number;
  formId: string;
  clearHref: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const countFa = count.toLocaleString('fa-IR');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `فیلترها، ${countFa} فیلتر فعال` : 'فیلترها'}
        className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary ${
          count > 0 ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border bg-input'
        } ${className}`}
      >
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 5h16l-6.2 7.4v5.3l-3.6 1.8v-7.1L4 5z" />
        </svg>
        <span aria-hidden>فیلترها</span>
        {count > 0 && (
          <span aria-hidden className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-black leading-none text-charcoal-950">
            {countFa}
          </span>
        )}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="فیلتر و جستجو"
        footer={
          <div className="flex gap-3">
            {count > 0 && (
              <Link href={clearHref} onClick={() => setOpen(false)} className="btn btn-outline shrink-0">
                حذف فیلترها
              </Link>
            )}
            <button type="submit" form={formId} className="btn btn-gold flex-1">
              نمایش نتایج
            </button>
          </div>
        }
      >
        {children}
      </Sheet>
    </>
  );
}
