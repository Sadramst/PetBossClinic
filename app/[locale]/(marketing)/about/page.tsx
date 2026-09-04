import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AboutPage() {
  const t = await getTranslations('About');

  const staff = await db.staffMember.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="section-padding">
      <div className="container-site">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-charcoal-800 mb-4">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">{t('subtitle')}</p>
        </div>

        {/* Story + Mission */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          <div className="bg-surface rounded-2xl p-8 border border-border/50">
            <div className="w-12 h-12 bg-gold-50 text-gold-600 rounded-xl flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-charcoal-800 mb-4">{t('ourStory')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('storyText')}</p>
          </div>
          <div className="bg-surface rounded-2xl p-8 border border-border/50">
            <div className="w-12 h-12 bg-gold-50 text-gold-600 rounded-xl flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 10-5.12 5.12a2.12 2.12 0 0 1-3 0v0a2.12 2.12 0 0 1 0-3L13 7"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-charcoal-800 mb-4">{t('ourMission')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('missionText')}</p>
          </div>
        </div>

        {/* Team */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-charcoal-800 mb-4">{t('teamTitle')}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">{t('teamSubtitle')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {staff.map((member) => (
            <div key={member.id} className="text-center group bg-white rounded-2xl p-6 border border-border/50 hover:border-gold-300 hover:shadow-md transition-all">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-gold-100 to-gold-200 flex items-center justify-center text-gold-700 text-2xl font-bold shadow-md">
                {member.nameFa.charAt(0)}
              </div>
              <h3 className="text-lg font-bold text-charcoal-800">{member.nameFa}</h3>
              <p className="text-sm text-gold-600 font-medium mb-2">{member.titleFa}</p>
              <p className="text-xs text-muted-foreground">{member.bioFa}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
