import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { formatPrice } from '@/lib/format/price';
import { productPath } from '@/lib/shop/urls';
import type { ProductCardData } from '@/lib/shop/catalog';
import { productImage } from '@/lib/shop/catalog';

const STOCK_LABEL: Record<string, { text: string; cls: string }> = {
  IN_STOCK: { text: 'موجود', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  LOW_STOCK: { text: 'موجودی محدود', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  ON_BACKORDER: { text: 'سفارشی', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  OUT_OF_STOCK: { text: 'ناموجود', cls: 'bg-charcoal-700/40 text-muted-foreground border-border' },
};

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const img = productImage(product);
  const stock = STOCK_LABEL[product.stockStatus] ?? STOCK_LABEL.OUT_OF_STOCK;
  const discount =
    product.comparePrice && product.comparePrice > product.price && product.price > 0
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : 0;

  return (
    <article className="card-luxury rounded-2xl overflow-hidden flex flex-col group border border-border hover:border-primary/60 transition-all">
      <Link href={productPath(product.slugFa)} className="relative block aspect-square bg-surface overflow-hidden">
        <Image
          src={img}
          alt={product.nameFa}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          priority={priority}
        />
        <span className={`absolute top-2 start-2 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${stock.cls}`}>
          {stock.text}
        </span>
        {discount > 0 && (
          <span className="absolute top-2 end-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-destructive text-white">
            ٪{discount.toLocaleString('fa-IR')} تخفیف
          </span>
        )}
      </Link>
      <div className="p-3 sm:p-4 flex flex-col flex-grow gap-1.5">
        <span className="text-[11px] font-semibold text-primary/90">{product.category.nameFa}</span>
        <h3 className="text-sm font-bold leading-snug line-clamp-2 min-h-[2.5rem]">
          <Link href={productPath(product.slugFa)} className="hover:text-primary transition-colors">
            {product.nameFa}
          </Link>
        </h3>
        <div className="mt-auto pt-2 border-t border-border/60 text-end">
          {discount > 0 && (
            <span className="block text-[11px] text-muted-foreground line-through">
              {formatPrice(product.comparePrice, 'fa')}
            </span>
          )}
          <span className="text-sm font-extrabold text-gradient-gold">{formatPrice(product.price, 'fa')}</span>
        </div>
      </div>
    </article>
  );
}
