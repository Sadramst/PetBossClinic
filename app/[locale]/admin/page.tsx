import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';
  const t = await getTranslations('Admin');

  // Fetch stats safely
  const [serviceCount, staffCount, faqCount, testimonialCount, leadCount, messageCount] = await Promise.all([
    db.service.count({ where: { isActive: true } }),
    db.staffMember.count({ where: { isActive: true } }),
    db.faq.count({ where: { isActive: true } }),
    db.testimonial.count({ where: { isActive: true } }),
    db.lead.count(),
    db.contactMessage.count(),
  ]);

  // Recent leads
  const recentLeads = await db.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // Recent messages
  const recentMessages = await db.contactMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const stats = [
    { label: t('totalServices'), value: serviceCount, icon: '💊', color: 'bg-primary/10 text-primary border-primary/20', href: '/admin/services' },
    { label: isEn ? 'Medical Staff' : 'کادر درمانی', value: staffCount, icon: '👨‍⚕️', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', href: '/admin/staff' },
    { label: isEn ? 'FAQs' : 'پرسش‌های متداول', value: faqCount, icon: '❓', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', href: '/admin/faqs' },
    { label: isEn ? 'Testimonials' : 'نظرات مراجعین', value: testimonialCount, icon: '💬', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', href: '/admin/testimonials' },
    { label: t('totalLeads'), value: leadCount, icon: '📋', color: 'bg-primary/15 text-primary border-primary/30', href: '/admin/leads' },
    { label: isEn ? 'Incoming Messages' : 'پیام‌های ورودی', value: messageCount, icon: '✉️', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', href: '/admin/messages' },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border-gold/50 shadow-gold">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {isEn ? 'Pet Boss Clinic Dashboard' : `${t('dashboard')} کلینیک پت‌باس`}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isEn
              ? 'Activity overview, inquiries, and platform health telemetry'
              : 'خلاصه فعالیت‌ها، سرنخ‌ها و وضعیت کلی پلتفرم دامپزشکی'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild className="bg-gradient-gold text-charcoal-950 font-bold rounded-xl text-xs shadow-gold">
            <Link href="/admin/theme">
              <span>🎨</span>
              <span className="ms-1.5">
                {isEn ? 'Live Dynamic Theme Studio' : 'تغییر پویای قالب سایت'}
              </span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {stats.map((stat, idx) => (
          <Link key={idx} href={stat.href} className="block group">
            <Card className="card-luxury p-5 border transition-all group-hover:border-primary">
              <CardContent className="p-0">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl border ${stat.color} shadow-sm shrink-0`}>
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {isEn ? stat.value.toLocaleString('en-US') : stat.value.toLocaleString('fa-IR')}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity: Leads & Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card className="card-luxury">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-foreground">{t('recentLeads')}</CardTitle>
            <Link href="/admin/leads" className="text-xs text-primary hover:underline">
              {isEn ? 'View all' : 'مشاهده همه'}
            </Link>
          </CardHeader>
          <CardContent className="p-5">
            {recentLeads.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                {isEn ? 'No inquiry records logged yet' : 'هنوز درخواستی ثبت نشده است'}
              </p>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between text-xs border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                    <div>
                      <p className="font-bold text-foreground">
                        {lead.name || (isEn ? 'Anonymous Client' : 'مراجعه‌کننده ناشناس')}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{lead.phone}</p>
                    </div>
                    <span className="text-[10px] bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-full font-semibold">
                      {lead.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card className="card-luxury">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-foreground">{t('recentMessages')}</CardTitle>
            <Link href="/admin/messages" className="text-xs text-primary hover:underline">
              {isEn ? 'View all' : 'مشاهده همه'}
            </Link>
          </CardHeader>
          <CardContent className="p-5">
            {recentMessages.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                {isEn ? 'No messages received yet' : 'هنوز پیامی دریافت نشده است'}
              </p>
            ) : (
              <div className="space-y-3">
                {recentMessages.map((msg) => (
                  <div key={msg.id} className="text-xs border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-foreground">{msg.name}</p>
                      <span className={`w-2 h-2 rounded-full ${msg.isRead ? 'bg-muted-foreground' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'}`} />
                    </div>
                    <p className="text-muted-foreground line-clamp-1 text-[11px]">{msg.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
