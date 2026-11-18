import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { ProductCard } from '@/components/shop/product-card';
import { AddToCart } from '@/components/shop/add-to-cart';
import { ProductGallery } from '@/components/product/product-gallery';
import { StickyBuyBar } from '@/components/product/sticky-buy-bar';
import { FavoriteButton } from '@/components/product/favorite-button';
import { LocalProductRail, RecentlyViewedTracker } from '@/components/product/recently-viewed';
import { Tabs } from '@/components/ui/tabs';
import { PriceTag } from '@/components/ui/price-tag';
import { SectionHeading } from '@/components/ui/section-heading';
import { ProductJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata, productSeoTitle } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/site';
import { getClinicNAP } from '@/lib/clinic/nap';
import { formatPrice } from '@/lib/format/price';
import { getProductBySlug, getRelatedProducts, productImage } from '@/lib/shop/catalog';
import { brandPath, categoryPath, decodeSlug, productPath } from '@/lib/shop/urls';
import { PetFit } from '@/components/shop/pet-fit';
import { SHIPPING } from '@/lib/shop/shipping';
import { zarinpalConfigured } from '@/lib/payments/zarinpal';
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

  // Blank lines in the admin text become paragraphs; single line breaks are kept inside them.
  const paragraphs = description
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  const lowLeft = inStock && sellable !== null && sellable > 0 && sellable <= 5 ? sellable : null;
  const stockLabel = !inStock
    ? 'ناموجود'
    : lowLeft
      ? `تنها ${lowLeft.toLocaleString('fa-IR')} عدد باقی مانده`
      : stockStatus === 'LOW_STOCK'
        ? 'موجودی محدود'
        : 'موجود در انبار';
  const stockTone = !inStock
    ? { text: 'text-muted-foreground', dot: 'bg-muted-foreground' }
    : lowLeft || stockStatus === 'LOW_STOCK'
      ? { text: 'text-amber-400', dot: 'bg-amber-400' }
      : { text: 'text-emerald-400', dot: 'bg-emerald-400' };
  const onlinePay = zarinpalConfigured();

  return (
    <div className="container mx-auto max-w-6xl px-4 pt-6 pb-10 sm:pt-10">
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

      <RecentlyViewedTracker product={cartLine} />

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="min-w-0 lg:sticky lg:top-header lg:self-start">
          <ProductGallery images={gallery} name={product.nameFa} />
        </div>

        {/* Buy box */}
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={categoryPath(product.category.slugFa)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {product.category.nameFa}
                </Link>
                <h1 className="mt-2 text-xl font-extrabold leading-relaxed sm:text-2xl sm:leading-relaxed">
                  {product.nameFa}
                </h1>
              </div>
              <FavoriteButton product={cartLine} />
            </div>
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
            <PetFit forSpecies={product.forSpecies} speciesNames={product.speciesCompatibility.map((s) => s.nameFa)} brandName={product.brand?.nameFa} />
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-surface-card p-4 sm:p-5">
            {/* 1. Price */}
            {product.price > 0 ? (
              <PriceTag price={product.price} compareAt={product.comparePrice} size="lg" className="[&_.text-gradient-gold]:font-black" />
            ) : (
              <p className="text-base font-bold">قیمت این کالا با تماس یا واتس‌اپ اعلام می‌شود.</p>
            )}

            {/* 2. Stock */}
            <p className={`flex items-center gap-2 text-sm font-bold ${stockTone.text}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${stockTone.dot}`} aria-hidden />
              {stockLabel}
            </p>

            {/* 3. Expiry: the date of the batch the customer will actually receive (FEFO) */}
            {shipExpiry ? (
              <div
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                  shipState === 'critical' ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-surface'
                }`}
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <InfoIcon name="calendar" className="h-4 w-4 text-primary" />
                  تاریخ انقضای کالای ارسالی
                </span>
                <b>{formatJalaliDate(shipExpiry)}</b>
              </div>
            ) : product.tracksExpiry ? (
              <div className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
                تاریخ انقضای این کالا پیش از ارسال توسط دامپزشک کنترل و به شما اعلام می‌شود.
              </div>
            ) : null}

            {/* 4. Buy / enquire (watched by the sticky mobile bar) */}
            <div id="buy-actions" className="scroll-mt-header space-y-3">
              {purchasable ? (
                <AddToCart product={cartLine} maxQuantity={sellable} />
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-surface px-4 py-3">
                    <p className="text-sm font-extrabold">
                      {inStock ? 'سفارش این کالا تلفنی انجام می‌شود' : 'این کالا در حال حاضر ناموجود است'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {inStock
                        ? 'برای اطلاع از قیمت روز و ثبت سفارش با کلینیک در تماس باشید.'
                        : 'برای اطلاع از زمان موجود شدن یا معرفی کالای جایگزین با ما در تماس باشید.'}
                    </p>
                  </div>
                  {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noopener" className="btn btn-gold btn-lg btn-block">
                      <InfoIcon name="whatsapp" className="h-5 w-5" />
                      {inStock ? 'استعلام قیمت در واتس‌اپ' : 'استعلام موجودی در واتس‌اپ'}
                    </a>
                  )}
                  <a href={nap.telLink} className={`btn btn-block ${whatsappUrl ? 'btn-outline' : 'btn-gold btn-lg'}`}>
                    <InfoIcon name="phone" className="h-4 w-4" />
                    تماس و سفارش تلفنی
                  </a>
                </>
              )}
            </div>

            {/* 5. Delivery / payment / authenticity */}
            <ul className="space-y-3 border-t border-border pt-4 text-sm">
              <InfoRow icon="truck" title="ارسال با پیک ویژه در تهران">
                هزینه ارسال {formatPrice(SHIPPING.tehranFee, 'fa')}؛ برای خرید بالای {formatPrice(SHIPPING.freeOver, 'fa')} رایگان
              </InfoRow>
              <InfoRow icon="card" title={onlinePay ? 'پرداخت آنلاین یا پرداخت در محل' : 'پرداخت هنگام تحویل'}>
                {onlinePay ? 'پرداخت در محل فقط برای سفارش‌های تهران' : 'ویژه سفارش‌های داخل تهران'}
              </InfoRow>
              <InfoRow icon="shield" title="ضمانت اصالت کالا">
                نگهداری و کنترل تاریخ انقضا زیر نظر دامپزشک
              </InfoRow>
            </ul>
            <a href="#delivery" className="inline-flex min-h-9 items-center text-xs font-bold text-primary hover:underline">
              جزئیات ارسال و بازگشت کالا
            </a>
          </div>

          {purchasable && (
            <div>
              <p className="mb-2 text-xs font-bold text-muted-foreground">نیاز به راهنمایی دارید؟</p>
              <div className="flex flex-wrap gap-2">
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener" className="btn btn-outline btn-sm min-h-11 flex-1">
                    <InfoIcon name="whatsapp" className="h-4 w-4" />
                    پرسش در واتس‌اپ
                  </a>
                )}
                <a href={nap.telLink} className="btn btn-outline btn-sm min-h-11 flex-1">
                  <InfoIcon name="phone" className="h-4 w-4" />
                  مشاوره تلفنی
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description, specs, delivery */}
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="min-w-0 rounded-2xl border border-border bg-surface-card p-4 sm:p-6 lg:col-span-2">
          <Tabs
            label="اطلاعات محصول"
            tabs={[
              {
                id: 'description',
                label: 'معرفی محصول',
                content: (
                  <>
                    <h2 className="mb-3 text-lg font-extrabold">معرفی {product.nameFa}</h2>
                    <div className="prose-fa">
                      {paragraphs.map((text, i) => (
                        <p key={i} className="whitespace-pre-line">
                          {text}
                        </p>
                      ))}
                    </div>
                  </>
                ),
              },
              {
                id: 'specs',
                label: 'مشخصات',
                content: (
                  <>
                    <h2 className="mb-3 text-lg font-extrabold">مشخصات</h2>
                    <dl className="overflow-hidden rounded-xl border border-border text-sm">
                      <Spec label="دسته‌بندی" value={product.category.nameFa} />
                      {product.brand && <Spec label="برند" value={product.brand.nameFa} />}
                      {product.sku && <Spec label="کد کالا" value={product.sku} ltr />}
                      {product.weight ? <Spec label="وزن" value={`${product.weight.toLocaleString('fa-IR')} کیلوگرم`} /> : null}
                      {product.dimensions && <Spec label="ابعاد" value={product.dimensions} />}
                      {product.speciesCompatibility.length > 0 && (
                        <Spec label="مناسب برای" value={product.speciesCompatibility.map((s) => s.nameFa).join('، ')} />
                      )}
                      {product.attributes.map((a) => (
                        <Spec key={a.id} label={a.nameFa} value={a.valueFa} />
                      ))}
                      {shipExpiry && <Spec label="انقضا" value={formatJalaliDate(shipExpiry)} />}
                    </dl>
                  </>
                ),
              },
            ]}
          />
        </section>

        <section id="delivery" aria-labelledby="delivery-title" className="scroll-mt-header rounded-2xl border border-border bg-surface-card p-4 sm:p-6 lg:self-start">
          <h2 id="delivery-title" className="mb-4 text-lg font-extrabold">
            ارسال و بازگشت کالا
          </h2>
          <ul className="space-y-4 text-sm">
            <InfoRow icon="truck" title="تهران: پیک ویژه">
              هزینه ارسال {formatPrice(SHIPPING.tehranFee, 'fa')}
            </InfoRow>
            <InfoRow icon="box" title="سایر استان‌ها: پست پیشتاز">
              هزینه ارسال {formatPrice(SHIPPING.postFee, 'fa')}
            </InfoRow>
            <InfoRow icon="gift" title="ارسال رایگان">
              برای سبدهای خرید بالای {formatPrice(SHIPPING.freeOver, 'fa')}
            </InfoRow>
            <InfoRow icon="card" title="روش پرداخت">
              {onlinePay
                ? 'پرداخت آنلاین برای همه سفارش‌ها؛ پرداخت در محل فقط در تهران'
                : 'پرداخت هنگام تحویل برای سفارش‌های تهران'}
            </InfoRow>
            <InfoRow icon="return" title="مغایرت یا آسیب‌دیدگی کالا">
              اگر کالای دریافتی با سفارش شما مغایرت داشت یا آسیب دیده بود، پیش از باز کردن بسته‌بندی با کلینیک تماس بگیرید تا پیگیری شود.
            </InfoRow>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            <a href={nap.telLink} className="btn btn-outline btn-sm min-h-11">
              <InfoIcon name="phone" className="h-4 w-4" />
              <span className="ltr-nums">{nap.phoneDisplayFa}</span>
            </a>
            <Link href="/faq" className="btn btn-ghost btn-sm min-h-11">
              پرسش‌های متداول
            </Link>
          </div>
        </section>
      </div>

      {related.length > 0 && (
        <section className="mt-12" aria-labelledby="related-title">
          <SectionHeading
            id="related-title"
            title={`محصولات مشابه در ${product.category.nameFa}`}
            href={categoryPath(product.category.slugFa)}
            linkAriaLabel={`مشاهده همه ${product.category.nameFa}`}
          />
          <ul className="rail rail-bleed pb-2 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:pb-0">
            {related.map((p) => (
              <li key={p.id} className="w-[46%] sm:w-[31%] lg:w-auto">
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <LocalProductRail source="recent" title="بازدیدهای اخیر شما" excludeId={product.id} className="mt-12" />
      <LocalProductRail source="favorites" title="علاقه‌مندی‌های شما" excludeId={product.id} className="mt-12" />

      {/* The sticky bar steps aside once this point scrolls into view, so it never covers the footer. */}
      <div id="product-end" aria-hidden className="h-px" />

      <StickyBuyBar watchId="buy-actions" endId="product-end">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-muted-foreground">{product.nameFa}</p>
          {product.price > 0 && (
            <PriceTag price={product.price} compareAt={product.comparePrice} size="sm" layout="inline" />
          )}
        </div>
        {purchasable ? (
          <AddToCart product={cartLine} maxQuantity={sellable} compact />
        ) : whatsappUrl ? (
          <a href={whatsappUrl} target="_blank" rel="noopener" className="btn btn-gold shrink-0 px-5">
            {inStock ? 'استعلام قیمت' : 'استعلام موجودی'}
          </a>
        ) : (
          <a href={nap.telLink} className="btn btn-gold shrink-0 px-5">
            تماس و سفارش
          </a>
        )}
      </StickyBuyBar>
    </div>
  );
}

function Spec({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex gap-4 px-4 py-3 odd:bg-surface/60">
      <dt className="w-2/5 shrink-0 text-start text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium">{ltr ? <bdi dir="ltr">{value}</bdi> : value}</dd>
    </div>
  );
}

type IconName = 'truck' | 'card' | 'shield' | 'box' | 'gift' | 'return' | 'calendar' | 'phone' | 'whatsapp';

const ICON_PATHS: Record<IconName, string[]> = {
  truck: ['M2 6h12v10H2z', 'M14 9h4l4 4v3h-8z', 'M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  card: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h3'],
  shield: ['M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z', 'm9 12 2 2 4-4'],
  box: ['m3 8 9-5 9 5v8l-9 5-9-5z', 'm3 8 9 5 9-5', 'M12 13v8'],
  gift: ['M4 11h16v9H4z', 'M3 7h18v4H3z', 'M12 7v13', 'M12 7C10 3 7 4 7 5s2 2 5 2zm0 0c2-4 5-3 5-2s-2 2-5 2z'],
  return: ['M4 9h11a5 5 0 0 1 0 10H8', 'M8 5 4 9l4 4'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  phone: ['M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z'],
  whatsapp: ['M4 20l1-4a8 8 0 1 1 3 3z', 'M9 9c0 3 3 6 6 6l1-2-2-1-1 1a4 4 0 0 1-2-2l1-1-1-2z'],
};

function InfoIcon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function InfoRow({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-primary">
        <InfoIcon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block font-bold">{title}</span>
        <span className="block text-xs text-muted-foreground">{children}</span>
      </span>
    </li>
  );
}
