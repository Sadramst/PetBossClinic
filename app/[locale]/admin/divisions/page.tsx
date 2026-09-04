import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

export default async function AdminDivisionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';

  const divisions = await db.division.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: { services: true }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isEn ? 'Core Clinic Departments' : 'بخش‌های اصلی کلینیک'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEn
            ? 'Manage the 3 primary clinical divisions: Medical, Grooming, and Pet Shop'
            : 'مدیریت ۳ بخش درمانی، گرومینگ و پت‌شاپ کلینیک پت‌باس'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {divisions.map((div) => {
          const divName = isEn ? (div.nameEn || div.nameFa) : div.nameFa;
          const divDesc = isEn ? (div.descriptionEn || div.descriptionFa) : div.descriptionFa;

          return (
            <Card key={div.id} className="card-luxury p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                  {div._count.services} {isEn ? 'services registered' : 'خدمت ثبت شده'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  div.isActive ? 'text-emerald-400 bg-emerald-500/15' : 'text-rose-400 bg-rose-500/15'
                }`}>
                  {div.isActive ? (isEn ? 'Active' : 'فعال') : (isEn ? 'Inactive' : 'غیرفعال')}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{divName}</h3>
                <p className="text-xs text-muted-foreground">{div.slugEn || div.slugFa}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {divDesc || (isEn ? 'No description available' : 'بدون توضیحات')}
              </p>
              <div className="pt-3 border-t border-border flex justify-end">
                <button className="text-xs text-primary font-bold hover:underline">
                  {isEn ? 'Edit Division' : 'ویرایش بخش'}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
