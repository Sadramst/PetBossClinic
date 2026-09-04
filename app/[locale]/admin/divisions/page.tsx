import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

export default async function AdminDivisionsPage() {
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
        <h1 className="text-2xl font-bold text-foreground">بخش‌های اصلی کلینیک</h1>
        <p className="text-sm text-muted-foreground">مدیریت ۳ بخش درمانی، گرومینگ و پت‌شاپ کلینیک پت‌باس</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {divisions.map((div) => (
          <Card key={div.id} className="card-luxury p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                {div._count.services} خدمت ثبت شده
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                div.isActive ? 'text-emerald-400 bg-emerald-500/15' : 'text-rose-400 bg-rose-500/15'
              }`}>
                {div.isActive ? 'فعال' : 'غیرفعال'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{div.nameFa}</h3>
              <p className="text-xs text-muted-foreground">{div.nameEn || div.slugFa}</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {div.descriptionFa || 'بدون توضیحات'}
            </p>
            <div className="pt-3 border-t border-border flex justify-end">
              <button className="text-xs text-primary font-bold hover:underline">ویرایش بخش</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
