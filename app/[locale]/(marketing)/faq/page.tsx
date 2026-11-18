import type { Metadata } from 'next';
import { db } from "@/lib/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PageHero } from '@/components/content/page-hero';
import { CtaBand } from '@/components/content/cta-band';
import { ChevronDownIcon } from '@/components/content/icons';
import { FAQPageJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { getClinicNAP } from "@/lib/clinic/nap";

export const revalidate = 60;

export function generateStaticParams() {
  return [{ locale: 'fa' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);

  return pageMetadata({
    title: 'سوالات متداول دامپزشکی | کلینیک پت‌باس تهران',
    description:
      'پاسخ دامپزشکان پت‌باس به سوالات متداول درباره واکسیناسیون، جراحی، گرومینگ، تغذیه و مراقبت از سگ و گربه در تهران.',
    path: '/faq',
    image: '/images/veterinarian.jpg',
    keywords: ['سوالات متداول دامپزشکی', 'زمان واکسن سگ و گربه', 'هزینه واکسیناسیون سگ تهران', 'مراقبت بعد از عقیم سازی'],
  });
}

const SHOP_HELP = [
  { href: '/shipping', title: 'راهنمای خرید و ارسال', text: 'روش‌های ارسال، هزینه‌ها و شیوه‌های پرداخت.' },
  { href: '/returns', title: 'رویه بازگرداندن کالا', text: 'شرایط و مهلت مرجوع کردن سفارش.' },
  { href: '/terms', title: 'قوانین و مقررات', text: 'شرایط استفاده از سایت و خرید از پت‌شاپ.' },
];

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FAQ');

  const [allCategories, nap] = await Promise.all([
    db.faqCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        faqs: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    }),
    getClinicNAP(),
  ]);

  const categories = allCategories.filter((cat) => cat.faqs.length > 0);
  const allFaqs = categories.flatMap((cat) =>
    cat.faqs.map((f) => ({ question: f.questionFa, answer: f.answerFa }))
  );

  return (
    <>
      {allFaqs.length > 0 && <FAQPageJsonLd faqs={allFaqs} />}
      <div className="bg-background">
        <PageHero
          crumbs={[
            { name: 'خانه', href: '/' },
            { name: 'سوالات متداول', href: '/faq' },
          ]}
          badge={t('badge')}
          title={t('title')}
          subtitle={t('subtitle')}
        />

        <div className="container-site section">
          <div className="mx-auto max-w-4xl">
            {categories.length > 1 && (
              <nav aria-label="دسته‌بندی پرسش‌ها" className="rail rail-bleed mb-6 gap-2">
                {categories.map((category) => (
                  <a key={category.id} href={`#faq-${category.id}`} className="chip min-h-11 px-4">
                    {category.nameFa}
                  </a>
                ))}
              </nav>
            )}

            {categories.length === 0 && (
              <p className="rounded-2xl border border-border bg-surface-card p-8 text-center text-sm leading-8 text-muted-foreground">
                {t('noFaqs')} برای پرسش خود با کلینیک تماس بگیرید.
              </p>
            )}

            <div className="space-y-6 sm:space-y-8">
              {categories.map((category) => (
                <section
                  key={category.id}
                  id={`faq-${category.id}`}
                  className="card-luxury scroll-mt-header p-4 sm:p-6"
                  aria-labelledby={`faq-title-${category.id}`}
                >
                  <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
                    <span aria-hidden className="h-6 w-1.5 shrink-0 rounded-full bg-gradient-gold" />
                    <h2 id={`faq-title-${category.id}`} className="text-lg font-bold text-foreground sm:text-xl">
                      {category.nameFa}
                    </h2>
                    <span className="ms-auto shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                      {category.faqs.length.toLocaleString('fa-IR')} {t('questionsSuffix')}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {category.faqs.map((faq) => (
                      <details key={faq.id} className="group overflow-hidden rounded-xl border border-border/60 bg-surface open:border-border-gold/60">
                        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold leading-7 text-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
                          <span>{faq.questionFa}</span>
                          <ChevronDownIcon className="h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="whitespace-pre-line border-t border-border/40 px-4 pb-4 pt-3 text-sm leading-8 text-muted-foreground">
                          {faq.answerFa}
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <section className="mt-8 sm:mt-10" aria-labelledby="shop-help-title">
              <h2 id="shop-help-title" className="mb-3 text-lg font-bold text-foreground">
                راهنمای خرید از پت‌شاپ
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {SHOP_HELP.map((item) => (
                  <Link key={item.href} href={item.href} className="surface-card hover-lift block p-4">
                    <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">{item.text}</p>
                  </Link>
                ))}
              </div>
            </section>

            <CtaBand
              className="mt-8 sm:mt-10"
              title={t('stillHaveQuestions')}
              text={`${t('contactPrompt')} ${nap.workingHoursSummaryFa}.`}
              nap={nap}
              callLabel={t('callDirect')}
            >
              <Link href="/contact" className="btn btn-secondary">{t('sendMessage')}</Link>
            </CtaBand>
          </div>
        </div>
      </div>
    </>
  );
}
