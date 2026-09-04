import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function Page() {
  const t = await getTranslations('Home');
  
  // Fetch services and staff for previews
  const services = await db.service.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    take: 3
  });

  const staff = await db.staffMember.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    take: 4
  });

  return (
    <div className="flex flex-col items-center">
      
      {/* Hero Section */}
      <section className="w-full bg-blue-50 py-24 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight mb-6">
            {t('heroTitle')}
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" className="rounded-full shadow-lg shadow-blue-500/30">
              {t('heroCta')}
            </Button>
            <Button variant="outline" size="lg" className="rounded-full bg-white">
              {t('heroSecondaryCta')}
            </Button>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="w-full py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('servicesTitle')}</h2>
            <p className="text-gray-600">{t('servicesSubtitle')}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.map((service) => (
              <Card key={service.id} className="hover:shadow-lg transition-shadow border-blue-100/50">
                <CardHeader>
                  <CardTitle className="text-xl text-blue-900">{service.nameFa}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-gray-600 line-clamp-3">
                    {service.descriptionFa}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="w-full py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('teamTitle')}</h2>
            <p className="text-gray-600">{t('teamSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {staff.map((member) => (
              <div key={member.id} className="flex flex-col items-center text-center">
                <Avatar className="w-32 h-32 mb-4 border-4 border-white shadow-md">
                  <AvatarImage src={`https://api.dicebear.com/7.x/notionists/svg?seed=${member.id}`} />
                  <AvatarFallback className="text-2xl bg-blue-100 text-blue-700">
                    {member.nameFa.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-bold text-gray-900">{member.nameFa}</h3>
                <p className="text-sm text-blue-600 mb-2 font-medium">{member.titleFa}</p>
                <p className="text-sm text-gray-500 line-clamp-2">{member.bioFa}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
