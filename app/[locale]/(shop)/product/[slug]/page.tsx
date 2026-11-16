import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { ProductCard } from '@/components/shop/product-card';
import { AddToCart } from '@/components/shop/add-to-cart';
import { ProductJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata, productSeoTitle } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/site';
import { getClinicNAP } from '@/lib/clinic/nap';
import { formatPrice } from '@/lib/format/price';
import { getProductBySlug, getRelatedProducts, productImage } from '@/lib/shop/catalog';
import { brandPath, categoryPath, decodeSlug, productPath } from '@/lib/shop/urls';
import { expiryState, formatJalaliDate, nextShippingExpiry, sellableQuantity } from '@/lib/shop/expiry';

export const revalidate = 300;

export function generateStaticParams() {
  // Rendered on first request, then cached (ISR). Keeps builds fast with 700+ products.
  return [];
}

type Params = Promise<{ locale: string; slug: string }>;

function seoDescription(p: { nameFa: string; shortDescFa: string | null; price: number; category: { nameFa: string } }) {
  const price = p.price > 0 ? ` با قیمت ${formatPrice(p.price, 'fa')}` : '';
  const base = p.shortDescFa && p.shortDescFa.length > 40 ? `${p.shortDescFa} ` : '';
  return `${base}خرید ${p.nameFa}${price} از پت‌شاپ کلینیک دامپزشکی پت‌باس؛ اصالت کالا، تاریخ انقضای معتبر و ارسال سریع در تهران. دسته ${p.category.nameFa}.`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await getProductBySlug(decodeSlug(slug));
  if (!product) return { title: 'محصول یافت نشد', robots: { index: false, follow: false } };

  const image = absoluteUrl(productImage(product));

  return pageMetadata({
    title: product.metaTitleFa || productSeoTitle(product.nameFa),
    description: product.metaDescriptionFa || seoDescription(product),
    path: productPath(product.slugFa),
    canonical: product.canonicalUrl,
    image,
    imageAlt: product.nameFa,
    noindex: product.noindex,
    keywords: [
      product.nameFa,
      product.category.nameFa,
      ...(product.brand ? [product.brand.nameFa] : []),
      'خرید',
      'قیمت',
    ],
  });
}

export default async function ProductPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const product = await getProductBySlug(decodeSlug(slug));
  if (!product) notFound();

  const [related, nap] = await Promise.all([
    getRelatedProducts(product.id, product.categoryId),
    getClinicNAP(),
  ]);

  const now = new Date();
  const url = absoluteUrl(productPath(product.slugFa));
  const images = product.images.map((i) => i.imageId).filter((src) => !src.startsWith('data:'));
  const gallery = images.length ? images : [productImage(product)];

  const hasBatches = product.inventory.length > 0;
  const shipExpiry = nextShippingExpiry(product.inventory, now);
  const shipState = expiryState(shipExpiry, now);
  // Once batches are recorded they are the source of truth: only expired/empty stock left = out of stock.
  const stockStatus =
    hasBatches && sellableQuantity(product.inventory, now) === 0 ? 'OUT_OF_STOCK' : product.stockStatus;
  const inStock = stockStatus === 'IN_STOCK' || stockStatus === 'LOW_STOCK';

  const discount =
    product.comparePrice && product.comparePrice > product.price && product.price > 0
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : 0;

  const description = product.descriptionFa || product.shortDescFa || seoDescription(product);
  const whatsappText = encodeURIComponent(
    `سلام، برای خرید «${product.nameFa}»${product.sku ? ` (کد ${product.sku})` : ''} از سایت پت‌باس پیام می‌دهم.\n${url}`
  );
  const whatsappUrl = nap.whatsappNumber
    ? `https://wa.me/${nap.whatsappNumber.replace(/\D/g, '')}?text=${whatsappText}`
    : null;

  const purchasable = inStock && product.price > 0;
  const sellable = hasBatches ? sellableQuantity(product.inventory, now) : null;
  const cartLine = {
    productId: product.id,
    name: product.nameFa,
    slug: product.slugFa,
    price: product.price,
    image: gallery[0],
  };

  const priceValidUntil = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  return (
    <div className="container mx-auto px-4 pt-6 pb-24 sm:pt-10 lg:pb-10 max-w-6xl">
      <ProductJsonLd
        product={{
          name: product.nameFa,
          description,
          url,
          images: gallery.map((g) => absoluteUrl(g)),
          sku: product.sku,
          barcode: product.barcode,
          brand: product.brand?.nameFa ?? product.brand?.nameEn ?? null,
          category: product.category.nameFa,
          price: product.price,
          stockStatus,
          priceValidUntil,
          weight: product.weight,
          attributes: product.attributes.map((a) => ({ name: a.nameFa, value: a.valueFa })),
        }}
      />

      <Breadcrumbs
        items={[
          { name: 'خانه', href: '/' },
          { name: 'پت‌شاپ', href: '/shop' },
          { name: product.category.nameFa, href: categoryPath(product.category.slugFa) },
          { name: product.nameFa, href: productPath(product.slugFa) },
        ]}
      />

      <div className="mt-5 grid gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-square rounded-3xl overflow-hidden border border-border bg-surface">
            <Image
              src={gallery[0]}
              alt={product.nameFa}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {gallery.slice(1, 5).map((src, i) => (
                <div key={src} className="relative aspect-square rounded-xl overflow-hidden border border-border">
                  <Image src={src} alt={`${product.nameFa} - تصویر ${i + 2}`} fill sizes="25vw" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buy box */}
        <div className="flex flex-col gap-5">
          <div>
            <Link
              href={categoryPath(product.category.slugFa)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {product.category.nameFa}
            </Link>
            <h1 className="mt-2 text-xl sm:text-2xl font-extrabold leading-relaxed">{product.nameFa}</h1>
            {product.nameEn && (
              <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                {product.nameEn}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {product.brand && (
                <span>
                  برند:{' '}
                  <Link href={brandPath(product.brand.slugFa)} className="font-bold text-foreground hover:text-primary">
                    {product.brand.nameFa}
                  </Link>
                </span>
              )}
              {product.sku && (
                <span>
                  کد کالا: <b className="text-foreground" dir="ltr">{product.sku}</b>
                </span>
              )}
              {product.speciesCompatibility.length > 0 && (
                <span>
                  مناسب:{' '}
                  <b className="text-foreground">{product.speciesCompatibility.map((s) => s.nameFa).join('، ')}</b>
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-card p-5 space-y-4">
            <div className="flex items-end justify-between gap-3">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                  inStock
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-charcoal-700/40 text-muted-foreground border-border'
                }`}
              >
                {inStock ? (stockStatus === 'LOW_STOCK' ? 'موجودی محدود' : 'موجود در انبار') : 'ناموجود'}
              </span>
              <div className="text-end">
                {discount > 0 && (
                  <div className="flex items-center justify-end gap-2 text-xs">
                    <span className="line-through text-muted-foreground">{formatPrice(product.comparePrice, 'fa')}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-destructive text-white font-bold">
                      ٪{discount.toLocaleString('fa-IR')}
                    </span>
                  </div>
                )}
                <div className="text-2xl font-black text-gradient-gold">{formatPrice(product.price, 'fa')}</div>
              </div>
            </div>

            {/* Expiry: the date of the batch the customer will actually receive (FEFO) */}
            {shipExpiry ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3 ${
                  shipState === 'critical' ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-surface'
                }`}
              >
                <span className="text-muted-foreground">تاریخ انقضای کالای ارسالی</span>
                <b>{formatJalaliDate(shipExpiry)}</b>
              </div>
            ) : product.tracksExpiry ? (
              <div className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
                تاریخ انقضای این کالا پیش از ارسال توسط دامپزشک کنترل و به شما اعلام می‌شود.
              </div>
            ) : null}

            {purchasable && <AddToCart product={cartLine} maxQuantity={sellable} />}
            <div className="grid grid-cols-2 gap-2">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener"
                  className={`py-3 rounded-xl font-bold text-sm text-center ${
                    purchasable
                      ? 'border border-border hover:border-primary'
                      : 'bg-gradient-gold text-charcoal-950 font-extrabold shadow-gold hover:opacity-90'
                  }`}
                >
                  {purchasable ? 'سوال دارید؟ واتس‌اپ' : 'استعلام موجودی در واتس‌اپ'}
                </a>
              )}
              <a
                href={nap.telLink}
                className="py-3 rounded-xl border border-primary text-primary font-bold text-sm text-center hover:bg-primary hover:text-charcoal-950 transition-colors"
              >
                {purchasable ? 'مشاوره تلفنی' : 'تماس و سفارش تلفنی'}
              </a>
            </div>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {['ضمانت اصالت کالا', 'نظارت دامپزشک بر نگهداری', 'ارسال سریع در تهران'].map((t) => (
              <li key={t} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-center text-muted-foreground">
                ✓ {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Description & specs */}
      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-surface-card p-6">
          <h2 className="text-lg font-bold mb-3">معرفی {product.nameFa}</h2>
          <div className="text-sm leading-8 text-foreground/85 whitespace-pre-line">{description}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface-card p-6">
          <h2 className="text-lg font-bold mb-3">مشخصات</h2>
          <dl className="text-sm divide-y divide-border">
            <Spec label="دسته‌بندی" value={product.category.nameFa} />
            {product.brand && <Spec label="برند" value={product.brand.nameFa} />}
            {product.weight ? <Spec label="وزن" value={`${product.weight.toLocaleString('fa-IR')} کیلوگرم`} /> : null}
            {product.dimensions && <Spec label="ابعاد" value={product.dimensions} />}
            {product.attributes.map((a) => (
              <Spec key={a.id} label={a.nameFa} value={a.valueFa} />
            ))}
            {shipExpiry && <Spec label="انقضا" value={formatJalaliDate(shipExpiry)} />}
          </dl>
        </div>
      </section>

      <div className="lg:hidden fixed inset-x-0 bottom-16 z-40 border-t border-border bg-surface/95 backdrop-blur px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{product.nameFa}</p>
          <p className="font-black text-gradient-gold">{formatPrice(product.price, 'fa')}</p>
        </div>
        {purchasable ? (
          <AddToCart product={cartLine} maxQuantity={sellable} compact />
        ) : whatsappUrl ? (
          <a href={whatsappUrl} target="_blank" rel="noopener" className="shrink-0 h-11 px-5 inline-flex items-center rounded-xl bg-gradient-gold text-charcoal-950 font-extrabold text-sm">
            استعلام موجودی
          </a>
        ) : (
          <a href={nap.telLink} className="shrink-0 h-11 px-5 inline-flex items-center rounded-xl bg-gradient-gold text-charcoal-950 font-extrabold text-sm">
            تماس و سفارش
          </a>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">محصولات مشابه در {product.category.nameFa}</h2>
            <Link href={categoryPath(product.category.slugFa)} className="text-xs text-primary hover:underline">
              مشاهده همه
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-end">{value}</dd>
    </div>
  );
}
