import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { QuickAddButton } from '@/components/shop/sort-select';
import { productPath } from '@/lib/shop/urls';
import type { ProductCardData } from '@/lib/shop/catalog';
import { productImage } from '@/lib/shop/catalog';

const fa = (n: number) => n.toLocaleString('fa-IR');

/** Only the exceptions get a badge: "in stock" on every card is noise. */
const STOCK_FLAG: Record<string, { text: string; cls: string }> = {
  LOW_STOCK: { text: 'تعداد محدود', cls: 'bg-amber-400 text-charcoal-950' },
  ON_BACKORDER: { text: 'پیش‌سفارش', cls: 'bg-sky-300 text-charcoal-950' },
};

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const img = productImage(product);
  const href = productPath(product.slugFa);
  // Packshots (bags, cans) are shown whole on white; the category fallback photo fills the tile.
  const ownImage = product.images[0]?.imageId;
  const isPackshot = !!ownImage && !ownImage.startsWith('data:');

  const outOfStock = product.stockStatus === 'OUT_OF_STOCK';
  const hasPrice = product.price > 0;
  const purchasable = hasPrice && (product.stockStatus === 'IN_STOCK' || product.stockStatus === 'LOW_STOCK');
  const flag = STOCK_FLAG[product.stockStatus];
  const discount =
    hasPrice && product.comparePrice && product.comparePrice > product.price
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : 0;

  return (
    <article className="card-luxury group flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="relative">
        <Link
          href={href}
          className={`relative block aspect-square overflow-hidden -outline-offset-2 ${isPackshot ? 'bg-white' : 'bg-surface'}`}
        >
          <Image
            src={img}
            alt={product.nameFa}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`transition-transform duration-500 group-hover:scale-105 ${
              isPackshot ? 'object-contain p-2.5 sm:p-3' : 'object-cover'
            } ${outOfStock ? 'opacity-60 grayscale' : ''}`}
            priority={priority}
          />
          {flag && (
            <span
              className={`absolute start-2 top-2 inline-flex h-6 items-center rounded-full px-2 text-[11px] font-extrabold leading-none shadow-sm ${flag.cls}`}
            >
              {flag.text}
            </span>
          )}
        </Link>
        {purchasable && (
          <QuickAddButton
            className="absolute bottom-2 end-2"
            product={{ productId: product.id, name: product.nameFa, slug: product.slugFa, price: product.price, image: img }}
          />
        )}
      </div>

      <div className="flex flex-grow flex-col gap-1 p-3 sm:p-4">
        <span className="truncate text-[11px] font-semibold text-primary/90">{product.category.nameFa}</span>
        <h3 className="line-clamp-2 min-h-12 text-[13px] font-bold leading-6 sm:text-sm sm:leading-6">
          <Link href={href} className="-outline-offset-2 transition-colors hover:text-primary">
            {product.nameFa}
          </Link>
        </h3>

        <div className="mt-auto flex min-h-[3.25rem] flex-col justify-end border-t border-border/60 pt-2">
          {outOfStock ? (
            <span className="text-sm font-bold text-muted-foreground">ناموجود</span>
          ) : !hasPrice ? (
            <span className="text-sm font-bold text-muted-foreground">تماس بگیرید</span>
          ) : (
            <>
              {discount > 0 && product.comparePrice && (
                <span className="flex items-center gap-1.5">
                  <s className="text-[11px] text-muted-foreground">
                    <span className="sr-only">قیمت قبلی: </span>
                    {fa(product.comparePrice)}
                  </s>
                  <span className="inline-flex h-5 items-center rounded-full bg-red-600 px-1.5 text-[11px] font-black leading-none text-white">
                    <span className="sr-only">تخفیف </span>٪{fa(discount)}
                  </span>
                </span>
              )}
              <span className="flex flex-wrap items-baseline gap-x-1">
                <span className="text-base font-black text-gradient-gold sm:text-lg">{fa(product.price)}</span>
                <span className="text-[11px] font-medium text-muted-foreground">تومان</span>
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
