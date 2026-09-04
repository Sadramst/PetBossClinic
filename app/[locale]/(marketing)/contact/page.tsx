import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function ContactPage() {
  const t = await getTranslations('Contact');

  return (
    <div className="section-padding">
      <div className="container-site">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-charcoal-800 mb-4">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-white rounded-2xl border border-border/50 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-charcoal-800 mb-6">{t('formTitle')}</h2>
            <form className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1.5">{t('name')}</label>
                <input type="text" className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-gold-400 focus:border-gold-400 outline-none transition" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-1.5">{t('phone')}</label>
                  <input type="tel" className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-gold-400 focus:border-gold-400 outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-1.5">{t('email')}</label>
                  <input type="email" className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-gold-400 focus:border-gold-400 outline-none transition" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1.5">{t('subject')}</label>
                <input type="text" className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-gold-400 focus:border-gold-400 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1.5">{t('message')}</label>
                <textarea rows={5} className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-gold-400 focus:border-gold-400 outline-none transition resize-none" />
              </div>
              <Button type="submit" className="w-full bg-gradient-gold hover:opacity-90 text-white rounded-full py-3 shadow-gold">
                {t('send')}
              </Button>
            </form>
          </div>

          {/* Contact Info + Map */}
          <div className="space-y-6">
            {/* Info Cards */}
            <div className="bg-surface rounded-2xl p-8 border border-border/50 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gold-600 uppercase tracking-wider mb-2">{t('addressTitle')}</h3>
                <p className="text-sm text-charcoal-700">تهران، خیابان شریعتی، نرسیده به مترو قیطریه، پلاک ۱۷۳۳</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gold-600 uppercase tracking-wider mb-2">{t('phoneTitle')}</h3>
                <a href="tel:+982122000000" className="text-sm text-charcoal-700 hover:text-gold-600 transition-colors">۰۲۱-۲۲XXXXXX</a>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gold-600 uppercase tracking-wider mb-2">{t('emailTitle')}</h3>
                <a href="mailto:info@petbossclinic.com" className="text-sm text-charcoal-700 hover:text-gold-600 transition-colors">info@petbossclinic.com</a>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gold-600 uppercase tracking-wider mb-2">{t('hoursTitle')}</h3>
                <p className="text-sm text-charcoal-700">شنبه تا پنج‌شنبه: ۹ الی ۲۱</p>
                <p className="text-sm text-charcoal-700">جمعه: ۱۰ الی ۱۴</p>
              </div>
            </div>

            {/* Map */}
            <div className="rounded-2xl overflow-hidden shadow-lg border border-border/50 aspect-video">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3237.5!2d51.4350853!3d35.790937!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMzXCsDQ3JzI3LjQiTiA1McKwMjYnMDYuMyJF!5e0!3m2!1sfa!2s!4v1"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Pet Boss Clinic Location"
              />
            </div>

            {/* Quick Action Buttons */}
            <div className="flex gap-3">
              <Button asChild className="flex-1 bg-gradient-gold hover:opacity-90 text-white rounded-full shadow-gold">
                <a href="https://www.google.com/maps?q=35.790937,51.4350853&z=17&hl=en" target="_blank" rel="noopener noreferrer">
                  مسیریابی
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1 rounded-full border-green-500 text-green-600 hover:bg-green-50">
                <a href="https://wa.me/989120000000" target="_blank" rel="noopener noreferrer">
                  واتساپ
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
