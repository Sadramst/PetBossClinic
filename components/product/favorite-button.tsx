'use client';

import { toast } from '@/components/ui/toaster';
import { toggleLocalProduct, useLocalProducts, type LocalProduct } from './local-lists';

/** Heart toggle. Favourites live in this browser only (no account needed). */
export function FavoriteButton({ product, className = '' }: { product: LocalProduct; className?: string }) {
  const active = useLocalProducts('favorites').some((p) => p.productId === product.productId);

  const onToggle = () => {
    const nowActive = toggleLocalProduct('favorites', product);
    toast.success(nowActive ? 'به علاقه‌مندی‌ها اضافه شد' : 'از علاقه‌مندی‌ها حذف شد');
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label="افزودن به علاقه‌مندی‌ها"
      title={active ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
      } ${className}`}
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    </button>
  );
}
