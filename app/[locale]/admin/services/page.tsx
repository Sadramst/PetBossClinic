import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default async function AdminServicesPage() {
  const services = await db.service.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { division: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مدیریت خدمات کلینیک</h1>
          <p className="text-sm text-muted-foreground">مشاهده، افزودن و ویرایش تعرفه‌ها و خدمات ارائه شده</p>
        </div>
        <Button className="bg-gradient-gold text-charcoal-950 font-bold rounded-xl text-xs shadow-gold">
          + افزودن خدمت جدید
        </Button>
      </div>

      <Card className="card-luxury">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-bold text-foreground">
            فهرست خدمات فعال و غیرفعال ({services.length} خدمت)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="text-xs uppercase bg-surface-elevated text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-start font-semibold">عنوان خدمت</th>
                <th className="px-5 py-3.5 text-start font-semibold">بخش</th>
                <th className="px-5 py-3.5 text-start font-semibold">مدت زمان</th>
                <th className="px-5 py-3.5 text-start font-semibold">قیمت پایه (تومان)</th>
                <th className="px-5 py-3.5 text-start font-semibold">وضعیت</th>
                <th className="px-5 py-3.5 text-start font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-surface-elevated/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-foreground">
                    <div>{service.nameFa}</div>
                    <div className="text-xs text-muted-foreground font-normal">{service.nameEn || '—'}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-medium">
                      {service.division.nameFa}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {service.durationFa || '—'}
                  </td>
                  <td className="px-5 py-4 font-bold text-primary">
                    {service.priceFrom ? service.priceFrom.toLocaleString('fa-IR') : 'استعلامی'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      service.isActive
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}>
                      {service.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button className="text-xs text-primary hover:underline font-semibold">ویرایش</button>
                      <span className="text-border">|</span>
                      <button className="text-xs text-muted-foreground hover:text-foreground">جزئیات</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
