import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboard() {
  const t = await getTranslations('Admin');

  // Fetch stats
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
    { label: t('totalServices'), value: serviceCount, icon: '💊', color: 'bg-blue-50 text-blue-600' },
    { label: 'کادر درمانی', value: staffCount, icon: '👨‍⚕️', color: 'bg-green-50 text-green-600' },
    { label: 'سوالات متداول', value: faqCount, icon: '❓', color: 'bg-purple-50 text-purple-600' },
    { label: 'نظرات مشتریان', value: testimonialCount, icon: '💬', color: 'bg-orange-50 text-orange-600' },
    { label: t('totalLeads'), value: leadCount, icon: '📋', color: 'bg-gold-50 text-gold-600' },
    { label: 'پیام‌ها', value: messageCount, icon: '✉️', color: 'bg-rose-50 text-rose-600' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-800 mb-1">{t('dashboard')}</h1>
        <p className="text-sm text-muted-foreground">خلاصه وضعیت سایت و آمار کلی</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, idx) => (
          <Card key={idx} className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${stat.color}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-charcoal-800">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">{t('recentLeads')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">هنوز سرنخی ثبت نشده</p>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                    <div>
                      <p className="font-medium text-charcoal-800">{lead.name || 'بدون نام'}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone}</p>
                    </div>
                    <span className="text-xs bg-gold-50 text-gold-600 px-2 py-0.5 rounded-full">{lead.status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">{t('recentMessages')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">هنوز پیامی ثبت نشده</p>
            ) : (
              <div className="space-y-3">
                {recentMessages.map((msg) => (
                  <div key={msg.id} className="text-sm border-b border-border/30 pb-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-charcoal-800">{msg.name}</p>
                      <span className={`w-2 h-2 rounded-full ${msg.isRead ? 'bg-charcoal-300' : 'bg-green-500'}`} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{msg.message}</p>
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
