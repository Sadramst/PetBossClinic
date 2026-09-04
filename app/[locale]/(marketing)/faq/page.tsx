import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { LuxuryPillBadge } from "@/components/ui/luxury-pill-badge";

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

  return (
    <div className="section-padding bg-background">
      <div className="container-site max-w-4xl">
        {/* Page Header */}
        <div className="text-center mb-16">
          <LuxuryPillBadge variant="outline" className="mb-3">
            {t('badge')}
          </LuxuryPillBadge>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">{t('subtitle')}</p>
        </div>

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
              <a href="tel:+982122000000">{t('callDirect')}</a>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-border-gold text-foreground hover:bg-surface-elevated px-8 py-6">
              <Link href="/contact">{t('sendMessage')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
