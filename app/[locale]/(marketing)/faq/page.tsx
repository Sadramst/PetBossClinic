import type { Metadata } from 'next';
import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { LuxuryPillBadge } from "@/components/ui/luxury-pill-badge";
import { BreadcrumbJsonLd, FAQPageJsonLd } from "@/lib/seo/json-ld";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === 'en';

  const title = isEn
    ? 'Frequently Asked Questions (FAQ)'
    : 'سوالات متداول دامپزشکی و نگهداری حیوانات خانگی | کلینیک پت باس تهران';

  const description = isEn
    ? 'Answers to common questions about pet vaccination schedules, grooming, surgery recovery, diet, and clinic policies at Pet Boss Clinic Tehran.'
    : 'پاسخ به سوالات متداول درباره زمان‌بندی واکسیناسیون سگ و گربه، مراقبت‌های پس از جراحی، گرومینگ، رژیم غذایی و خدمات کلینیک دامپزشکی پت باس.';

  return {
    title,
    description,
    keywords: isEn
      ? ['veterinary FAQ Tehran', 'dog vaccination schedule', 'cat grooming FAQ', 'pet surgery care']
      : ['سوالات متداول دامپزشکی', 'زمان واکسن سگ و گربه', 'هزینه واکسیناسیون سگ تهران', 'مراقبت بعد از عقیم سازی'],
    alternates: {
      canonical: isEn ? '/en/faq' : '/faq',
      languages: { 'fa-IR': '/faq', en: '/en/faq' },
    },
    openGraph: {
      title,
      description,
      url: isEn ? '/en/faq' : '/faq',
      images: [{ url: '/images/petboss-sign.jpg', width: 1200, height: 630 }],
    },
  };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';
  const t = await getTranslations('FAQ');

  const categories = await db.faqCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      faqs: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  const allFaqs = categories.flatMap((cat) =>
    cat.faqs.map((f) => ({
      question: isEn ? (f.questionEn || f.questionFa) : f.questionFa,
      answer: isEn ? (f.answerEn || f.answerFa) : f.answerFa,
    }))
  );

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: isEn ? 'Home' : 'خانه', href: '/' },
          { name: isEn ? 'FAQ' : 'سوالات متداول', href: '/faq' },
        ]}
        locale={locale}
      />
      {allFaqs.length > 0 && <FAQPageJsonLd faqs={allFaqs} />}
      <div className="bg-background">
      {/* Dynamic Theme Top Page Header */}
      <section className="relative bg-gradient-hero text-foreground overflow-hidden border-b border-border/60 py-16 md:py-20 mb-12">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
        </div>
        <div className="container-site relative z-10 text-center">
          <LuxuryPillBadge variant="outline" className="mb-3">
            {t('badge')}
          </LuxuryPillBadge>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">{t('subtitle')}</p>
        </div>
      </section>

      <div className="container-site max-w-4xl pb-20">

        {/* FAQ by Category */}
        <div className="space-y-12">
          {categories.map((category) => {
            const catName = isEn ? (category.nameEn || category.nameFa) : category.nameFa;

            return (
              <div key={category.id} className="card-luxury p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                  <div className="w-2 h-6 bg-gradient-gold rounded-full" />
                  <h2 className="text-xl font-bold text-foreground">{catName}</h2>
                  <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-bold ms-auto">
                    {category.faqs.length} {t('questionsSuffix')}
                  </span>
                </div>
                <div className="space-y-3">
                  {category.faqs.map((faq) => {
                    const qText = isEn ? (faq.questionEn || faq.questionFa) : faq.questionFa;
                    const aText = isEn ? (faq.answerEn || faq.answerFa) : faq.answerFa;

                    return (
                      <details key={faq.id} className="group rounded-xl bg-surface border border-border/60 overflow-hidden cursor-pointer">
                        <summary className="flex items-center justify-between px-5 py-4 text-sm font-bold text-foreground hover:text-primary transition-colors list-none">
                          <span>{qText}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6"/></svg>
                        </summary>
                        <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
                          {aText}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Still have questions? */}
        <div className="mt-16 text-center card-luxury p-10 border-border-gold shadow-gold">
          <h3 className="text-2xl font-bold mb-3 text-foreground">{t('stillHaveQuestions')}</h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm leading-relaxed">{t('contactPrompt')}</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild className="bg-gradient-gold hover:opacity-90 text-charcoal-950 font-bold rounded-full shadow-gold px-8 py-6">
              <a href="tel:+982126429715">{t('callDirect')}</a>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-border-gold text-foreground hover:bg-surface-elevated px-8 py-6">
              <Link href="/contact">{t('sendMessage')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
