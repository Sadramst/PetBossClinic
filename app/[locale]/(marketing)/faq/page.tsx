import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function FaqPage() {
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
    <div className="section-padding">
      <div className="container-site max-w-4xl">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-charcoal-800 mb-4">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">{t('subtitle')}</p>
        </div>

        {/* FAQ by Category */}
        <div className="space-y-12">
          {categories.map((category) => (
            <div key={category.id}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-6 bg-gradient-gold rounded-full" />
                <h2 className="text-xl font-bold text-charcoal-800">{category.nameFa}</h2>
                <span className="text-xs bg-gold-50 text-gold-600 px-2 py-0.5 rounded-full font-medium">
                  {category.faqs.length}
                </span>
              </div>
              <div className="space-y-3">
                {category.faqs.map((faq) => (
                  <details key={faq.id} className="group bg-white rounded-xl border border-border/50 overflow-hidden">
                    <summary className="flex items-center justify-between cursor-pointer px-6 py-4 text-sm font-semibold text-charcoal-800 hover:bg-gold-50/50 transition-colors list-none">
                      <span>{faq.questionFa}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gold-500 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6"/></svg>
                    </summary>
                    <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
                      {faq.answerFa}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Still have questions? */}
        <div className="mt-16 text-center bg-charcoal-800 rounded-2xl p-10 text-white">
          <h3 className="text-xl font-bold mb-3">{t('stillHaveQuestions')}</h3>
          <p className="text-charcoal-300 mb-6">{t('contactPrompt')}</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button asChild className="bg-gradient-gold hover:opacity-90 text-white rounded-full shadow-gold px-8">
              <a href="tel:+982122000000">تماس بگیرید</a>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-charcoal-500 text-charcoal-200 hover:bg-charcoal-700 px-8">
              <Link href="/contact">ارسال پیام</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
