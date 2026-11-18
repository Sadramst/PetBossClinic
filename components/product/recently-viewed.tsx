'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { PriceTag } from '@/components/ui/price-tag';
import { productPath } from '@/lib/shop/urls';
import { pushLocalProduct, useLocalProducts, type LocalListName, type LocalProduct } from './local-lists';

/** Records the product being viewed. Renders nothing. */
export function RecentlyViewedTracker({ product }: { product: LocalProduct }) {
  const { productId, slug, name, image, price } = product;
  useEffect(() => {
    pushLocalProduct('recent', { productId, slug, name, image, price });
  }, [productId, slug, name, image, price]);
  return null;
}

/**
 * Horizontal rail of products remembered in this browser (recently viewed or favourites).
 * Hides itself when there is nothing to show. Prices are the ones seen at the time.
 */
export function LocalProductRail({
  source,
  title,
  excludeId,
  className = '',
}: {
  source: LocalListName;
  title: string;
  excludeId?: string;
  className?: string;
}) {
  const items = useLocalProducts(source).filter((p) => p.productId !== excludeId);
  if (items.length === 0) return null;

  return (
    <section className={className} aria-label={title}>
      <h2 className="mb-4 text-lg font-extrabold">{title}</h2>
      <ul className="rail rail-bleed pb-1">
        {items.map((p) => (
          <li key={p.productId} className="w-36 sm:w-44">
            <Link
              href={productPath(p.slug)}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-card transition-colors hover:border-primary/60"
            >
              <span className="relative block aspect-square bg-white">
                <Image src={p.image} alt="" fill sizes="176px" className="object-contain p-1.5" />
              </span>
              <span className="flex flex-1 flex-col gap-2 p-3">
                <span className="clamp-2 text-xs font-bold leading-6 group-hover:text-primary">{p.name}</span>
                <PriceTag price={p.price} size="sm" className="mt-auto" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
