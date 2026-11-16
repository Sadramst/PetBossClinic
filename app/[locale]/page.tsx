import type { Metadata } from 'next';
import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { Link } from '@/i18n/routing';
import { SiteSearch } from '@/components/layout/header';
import { ProductCard } from '@/components/shop/product-card';
import { getClinicNAP } from '@/lib/clinic/nap';
import { formatServicePrice } from '@/lib/format/price';
import { VeterinaryCareJsonLd, FAQPageJsonLd } from '@/lib/seo/json-ld';
import { SITE_URL } from '@/lib/seo/site';
import { getActiveCategories, getNavCatalog, getProductRail, type ProductCardData } from '@/lib/shop/catalog';
import { brandPath, categoryPath } from '@/lib/shop/urls';

export const revalidate = 300;

export function generateStaticParams() {
  return [{ locale: 'fa' }];
}

const TITLE = 'پت‌شاپ و کلینیک دامپزشکی پت‌باس | خرید غذا و لوازم سگ و گربه در تهران';
const DESCRIPTION =
  'خرید آنلاین غذای سگ و گربه، تشویقی، دارو و لوازم حیوانات خانگی با ضمانت اصالت و تاریخ انقضای معتبر از پت‌شاپ پت‌باس؛ و کلینیک تخصصی دامپزشکی، جراحی، واکسیناسیون و گرومینگ در قیطریه تهران.';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return {
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: { canonical: SITE_URL },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: SITE_URL,
      images: [{ url: '/images/petboss-sign.jpg', width: 1200, height: 630, alt: TITLE }],
    },
  };
}

const TRUST = [
  { icon: '🛡️', title: 'ضمانت اصالت', text: 'فقط کالای اصل از واردکنندگان معتبر' },
  { icon: '📅', title: 'تاریخ انقضای معتبر', text: 'تاریخ انقضای هر کالا روی صفحه محصول' },
  { icon: '🩺', title: 'مشاوره رایگان دامپزشک', text: 'انتخاب غذا و مکمل با نظر دامپزشک' },
  { icon: '🚚', title: 'ارسال سریع در تهران', text: 'تحویل با پیک در کوتاه‌ترین زمان' },
];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [sections, siteSetting, nap, categories, nav, featured, catFood, dogFood, treats, divisions, services, staff, testimonials, faqs] =
    await Promise.all([
      db.homepageSection.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.siteSetting.findFirst({ select: { heroTitleFa: true, heroSubtitleFa: true } }),
      getClinicNAP(),
      getActiveCategories(),
      getNavCatalog(),
      getProductRail({ isFeatured: true }, 10),
      getProductRail({ category: { slugFa: { in: ['cat-dry-food', 'cat-wet-food'] } } }, 10),
      getProductRail({ category: { slugFa: { in: ['dog-dry-food', 'dog-wet-food'] } } }, 10),
      getProductRail({ category: { slugFa: { in: ['cat-treats', 'dog-treats'] } } }, 10),
      db.division.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      db.service.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 6, include: { division: true } }),
      db.staffMember.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 4 }),
      db.testimonial.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 6 }),
      db.faq.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 8 }),
    ]);

  // Admin-managed section titles and visibility (Admin > Homepage)
  const sec = new Map(sections.map((s) => [s.key, s]));
  const visible = (key: string) => sec.get(key)?.isVisible !== false;
  const titleOf = (key: string, fallback: string) => sec.get(key)?.titleFa || fallback;
  const subtitleOf = (key: string, fallback: string) => sec.get(key)?.subtitleFa || fallback;

  const hero = sec.get('hero');
  const heroTitle = hero?.titleFa || siteSetting?.heroTitleFa || 'پت‌شاپ و کلینیک دامپزشکی پت‌باس';
  const heroSubtitle =
    hero?.subtitleFa ||
    siteSetting?.heroSubtitleFa ||
    'غذا، تشویقی و لوازم اصل سگ و گربه با تاریخ انقضای معتبر، در کنار خدمات تخصصی دامپزشکی و گرومینگ در قیطریه تهران.';

  const shopCategories = categories.filter((c) => c._count.products > 0);
  const popularChips = shopCategories.slice(0, 6);
  // If nothing is marked featured yet, fall back to in-stock picks.
  const picks = featured.length >= 4 ? featured : await getProductRail({}, 10);

  return (
    <>
      <VeterinaryCareJsonLd nap={nap} locale="fa" />
      {faqs.length > 0 && <FAQPageJsonLd faqs={faqs.map((f) => ({ question: f.questionFa, answer: f.answerFa }))} />}

      {/* ═══ HERO ═══ */}
      {visible('hero') && (
        <section className="relative overflow-hidden border-b border-border bg-gradient-hero">
          <div className="absolute -top-40 start-1/3 w-[32rem] h-[32rem] rounded-full bg-[radial-gradient(circle,rgba(197,160,89,0.14)_0%,transparent_70%)] pointer-events-none" />
          <div className="container mx-auto max-w-7xl px-4 py-10 lg:py-16 grid gap-10 lg:grid-cols-[1.15fr_1fr] items-center relative">
            <div className="space-y-6">
              {hero?.badgeFa && (
                <span className="inline-block text-xs font-bold px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary">
                  {hero.badgeFa}
                </span>
              )}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.35]">{heroTitle}</h1>
              <p className="text-base text-muted-foreground leading-8 max-w-xl">{heroSubtitle}</p>
              <SiteSearch id="hero-search" className="hidden md:block max-w-xl" />
              {popularChips.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-muted-foreground py-1.5">پرطرفدار:</span>
                  {popularChips.map((c) => (
                    <Link
                      key={c.id}
                      href={categoryPath(c.slugFa)}
                      className="rounded-full border border-border bg-surface-card px-3 py-1.5 hover:border-primary hover:text-primary"
                    >
                      {c.nameFa}
                    </Link>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Link href="/shop" className="h-12 px-7 inline-flex items-center rounded-2xl bg-gradient-gold text-charcoal-950 font-extrabold shadow-gold hover:opacity-90">
                  {hero?.ctaLabelFa || 'ورود به پت‌شاپ'}
                </Link>
                <a href={nap.telLink} className="h-12 px-7 inline-flex items-center rounded-2xl border border-primary text-primary font-bold hover:bg-primary hover:text-charcoal-950 transition-colors">
                  نوبت‌دهی کلینیک
                </a>
              </div>
            </div>
            <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden border border-border-gold shadow-gold-lg">
              <Image src="/images/petshop.jpg" alt="فروشگاه پت‌شاپ پت‌باس در قیطریه تهران" fill priority sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover" />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-surface/85 backdrop-blur border border-border p-4 text-sm">
                <p className="font-bold">پت‌شاپ و کلینیک پت‌باس، قیطریه</p>
                <p className="text-muted-foreground text-xs mt-1">{nap.workingHoursSummaryFa}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ TRUST ═══ */}
      <section aria-label="چرا پت‌باس" className="border-b border-border bg-surface">
        <ul className="container mx-auto max-w-7xl px-4 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {TRUST.map((t) => (
            <li key={t.title} className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden>{t.icon}</span>
              <div>
                <p className="font-bold text-sm">{t.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {visible('shop') && (
        <>
          {/* ═══ SHOP BY PET ═══ */}
          <section className="container mx-auto max-w-7xl px-4 pt-12">
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { pet: 'cat', title: 'همه چیز برای گربه', text: 'غذای خشک و پوچ، تشویقی، خاک و اسباب‌بازی', img: '/images/categories/cat-dry-food.jpg' },
                { pet: 'dog', title: 'همه چیز برای سگ', text: 'غذای خشک و کنسرو، تشویقی، قلاده و لوازم', img: '/images/categories/dog-dry-food.jpg' },
              ].map((p) => (
                <Link key={p.pet} href={`/shop?pet=${p.pet}`} className="group relative h-44 sm:h-56 rounded-3xl overflow-hidden border border-border hover:border-primary">
                  <Image src={p.img} alt={p.title} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-l from-charcoal-950/90 via-charcoal-950/50 to-transparent" />
                  <div className="absolute inset-y-0 start-0 p-6 flex flex-col justify-center max-w-xs">
                    <h2 className="text-xl sm:text-2xl font-black text-white">{p.title}</h2>
                    <p className="text-sm text-white/80 mt-2">{p.text}</p>
                    <span className="mt-4 text-sm font-bold text-gold-300">مشاهده محصولات ←</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ═══ CATEGORIES ═══ */}
          <section className="container mx-auto max-w-7xl px-4 pt-12">
            <SectionHead
              title={titleOf('shop', 'دسته‌بندی‌های پت‌شاپ')}
              subtitle={subtitleOf('shop', 'هر آنچه دوست پشمالوی شما نیاز دارد، دسته‌بندی‌شده و آماده خرید.')}
              href="/shop"
            />
            <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {shopCategories.map((c) => (
                <li key={c.id}>
                  <Link href={categoryPath(c.slugFa)} className="group flex flex-col items-center gap-2 text-center">
                    <span className="relative w-full aspect-square rounded-2xl overflow-hidden border border-border group-hover:border-primary transition-colors">
                      <Image
                        src={c.imageId && !c.imageId.startsWith('data:') ? c.imageId : '/images/categories/other.jpg'}
                        alt={c.nameFa}
                        fill
                        sizes="(max-width: 640px) 33vw, 12vw"
                        className="object-cover"
                      />
                    </span>
                    <span className="text-xs leading-5 group-hover:text-primary">{c.nameFa}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <ProductRail title="پیشنهاد ویژه پت‌باس" href="/shop" products={picks} />
          <ProductRail title="غذای گربه" href="/shop?pet=cat" products={catFood} />
          <ProductRail title="غذای سگ" href="/shop?pet=dog" products={dogFood} />
          <ProductRail title="تشویقی سگ و گربه" href={categoryPath('cat-treats')} products={treats} />

          {/* ═══ BRANDS ═══ */}
          {nav.brands.length > 0 && (
            <section className="container mx-auto max-w-7xl px-4 pt-12">
              <SectionHead title="برندهای معتبر" subtitle="محصولات اصل از برندهای شناخته‌شده جهانی" />
              <ul className="flex flex-wrap gap-2">
                {nav.brands.map((b) => (
                  <li key={b.id}>
                    <Link href={brandPath(b.slugFa)} className="inline-block rounded-xl border border-border bg-surface-card px-4 py-2.5 text-sm hover:border-primary hover:text-primary">
                      {b.nameFa}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* ═══ CLINIC ═══ */}
      {(visible('divisions') || visible('services')) && (
        <section className="mt-16 border-y border-border bg-surface">
          <div className="container mx-auto max-w-7xl px-4 py-14 space-y-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] items-center">
              <div className="space-y-4">
                <span className="text-xs font-bold text-primary">کلینیک تخصصی دامپزشکی</span>
                <h2 className="text-2xl sm:text-3xl font-black leading-[1.4]">
                  {titleOf('divisions', 'درمان، جراحی و گرومینگ زیر یک سقف')}
                </h2>
                <p className="text-sm text-muted-foreground leading-8">
                  {subtitleOf(
                    'divisions',
                    'دامپزشکان پت‌باس همه روزه در قیطریه آماده معاینه، واکسیناسیون، جراحی، دندانپزشکی و گرومینگ سگ و گربه هستند.'
                  )}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/services" className="h-11 px-6 inline-flex items-center rounded-2xl bg-gradient-gold text-charcoal-950 font-bold">
                    خدمات و تعرفه‌ها
                  </Link>
                  <a href={nap.telLink} className="h-11 px-6 inline-flex items-center rounded-2xl border border-primary text-primary font-bold">
                    رزرو نوبت
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['/images/veterinarian.jpg', '/images/grooming.jpg', '/images/reception.jpg', '/images/petboss-signboard.jpg'].map((src, i) => (
                  <div key={src} className={`relative rounded-2xl overflow-hidden border border-border ${i % 2 ? 'aspect-[4/5] translate-y-6' : 'aspect-[4/5]'}`}>
                    <Image src={src} alt="کلینیک دامپزشکی پت‌باس" fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {visible('divisions') && divisions.length > 0 && (
              <ul className="grid sm:grid-cols-3 gap-4">
                {divisions.map((d) => (
                  <li key={d.id} className="rounded-2xl border border-border bg-surface-card p-5">
                    <h3 className="font-bold">{d.nameFa}</h3>
                    {d.descriptionFa && <p className="text-sm text-muted-foreground mt-2 leading-7 line-clamp-3">{d.descriptionFa}</p>}
                  </li>
                ))}
              </ul>
            )}

            {visible('services') && services.length > 0 && (
              <div>
                <SectionHead title={titleOf('services', 'خدمات پرمراجعه کلینیک')} href="/services" />
                <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {services.map((s) => (
                    <li key={s.id} className="rounded-2xl border border-border bg-surface-card p-5 flex flex-col">
                      <span className="text-[11px] font-semibold text-primary">{s.division.nameFa}</span>
                      <h3 className="font-bold mt-1">{s.nameFa}</h3>
                      {s.descriptionFa && <p className="text-sm text-muted-foreground mt-2 leading-7 line-clamp-2">{s.descriptionFa}</p>}
                      <div className="mt-auto pt-4 flex items-center justify-between text-sm">
                        <span className="font-bold text-primary">{formatServicePrice(s.priceDisplayMode, s.priceFrom, s.priceTo, 'fa')}</span>
                        <a href={nap.telLink} className="text-xs text-primary hover:underline">نوبت بگیرید</a>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══ TEAM ═══ */}
      {visible('staff') && staff.length > 0 && (
        <section className="container mx-auto max-w-7xl px-4 pt-14">
          <SectionHead title={titleOf('staff', 'کادر دامپزشکی')} subtitle={sec.get('staff')?.subtitleFa ?? undefined} />
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {staff.map((v) => (
              <li key={v.id} className="rounded-2xl border border-border bg-surface-card p-5 text-center">
                <div className="relative w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-border-gold bg-surface">
                  {v.photoId && <Image src={v.photoId} alt={v.nameFa} fill sizes="80px" className="object-cover" />}
                </div>
                <h3 className="font-bold mt-3">{v.nameFa}</h3>
                <p className="text-xs text-primary mt-1">{v.titleFa}</p>
                {v.specialtyFa && <p className="text-xs text-muted-foreground mt-1">{v.specialtyFa}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ═══ TESTIMONIALS ═══ */}
      {visible('testimonials') && testimonials.length > 0 && (
        <section className="container mx-auto max-w-7xl px-4 pt-14">
          <SectionHead title={titleOf('testimonials', 'نظر مشتریان پت‌باس')} />
          <ul className="grid md:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <li key={t.id} className="rounded-2xl border border-border bg-surface-card p-5 flex flex-col">
                <p className="text-primary" aria-label={`امتیاز ${t.rating || 5} از ۵`}>{'★'.repeat(t.rating || 5)}</p>
                <blockquote className="text-sm leading-7 mt-3 flex-1">«{t.contentFa}»</blockquote>
                <p className="text-xs font-bold mt-4">{t.nameFa}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ═══ FAQ ═══ */}
      {visible('faq') && faqs.length > 0 && (
        <section className="container mx-auto max-w-4xl px-4 pt-14">
          <SectionHead title={titleOf('faq', 'سوالات متداول')} href="/faq" />
          <div className="space-y-2">
            {faqs.map((f) => (
              <details key={f.id} className="group rounded-2xl border border-border bg-surface-card">
                <summary className="cursor-pointer list-none p-4 font-semibold flex justify-between gap-3">
                  {f.questionFa}
                  <span className="text-primary group-open:rotate-45 transition-transform" aria-hidden>＋</span>
                </summary>
                <p className="px-4 pb-4 text-sm text-muted-foreground leading-7">{f.answerFa}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* ═══ LOCATION ═══ */}
      {visible('contact') && (
        <section className="container mx-auto max-w-7xl px-4 py-14">
          <div className="grid gap-6 lg:grid-cols-2 rounded-3xl border border-border bg-surface-card overflow-hidden">
            <div className="p-6 sm:p-8 space-y-4">
              <h2 className="text-2xl font-black">{titleOf('contact', 'مراجعه حضوری به پت‌باس')}</h2>
              <p className="text-sm text-muted-foreground leading-7">{nap.addressFa}</p>
              <p className="text-sm">ساعات کاری: {nap.workingHoursSummaryFa}</p>
              <p className="text-sm">
                تلفن:{' '}
                <a href={nap.telLink} className="text-primary font-bold" dir="ltr">
                  {nap.phoneDisplayFa}
                </a>
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <a href={`https://maps.google.com/?q=${nap.geo.lat},${nap.geo.lng}`} target="_blank" rel="noopener" className="rounded-xl border border-border px-4 py-2 text-sm hover:border-primary">
                  مسیریابی گوگل مپ
                </a>
                <a href={`https://neshan.org/maps/@${nap.geo.lat},${nap.geo.lng},16z`} target="_blank" rel="noopener" className="rounded-xl border border-border px-4 py-2 text-sm hover:border-primary">
                  مسیریابی نشان
                </a>
                <a href={`https://waze.com/ul?ll=${nap.geo.lat},${nap.geo.lng}&navigate=yes`} target="_blank" rel="noopener" className="rounded-xl border border-border px-4 py-2 text-sm hover:border-primary">
                  ویز
                </a>
              </div>
            </div>
            <iframe
              title="موقعیت کلینیک پت‌باس روی نقشه"
              src={`https://maps.google.com/maps?q=${nap.geo.lat},${nap.geo.lng}&hl=fa&z=16&output=embed`}
              className="w-full h-72 lg:h-full min-h-72 border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      )}
    </>
  );
}

function SectionHead({ title, subtitle, href }: { title: string; subtitle?: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-black">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-sm text-primary hover:underline">
          مشاهده همه
        </Link>
      )}
    </div>
  );
}

function ProductRail({ title, href, products }: { title: string; href: string; products: ProductCardData[] }) {
  if (products.length === 0) return null;
  return (
    <section className="container mx-auto max-w-7xl px-4 pt-12">
      <SectionHead title={title} href={href} />
      <ul className="flex gap-3 sm:gap-4 overflow-x-auto snap-x pb-3 -mx-4 px-4">
        {products.map((p) => (
          <li key={p.id} className="snap-start shrink-0 w-[46%] sm:w-[31%] lg:w-[19%]">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
