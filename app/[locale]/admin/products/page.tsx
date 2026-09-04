import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const products = await db.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: { category: true },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">کاتالوگ محصولات پت‌شاپ</h1>
          <p className="text-sm text-muted-foreground">مدیریت محصولات غذایی، بهداشتی و لوازم لوکس پت‌شاپ</p>
        </div>
        <Button className="bg-gradient-gold text-charcoal-950 font-bold rounded-xl text-xs shadow-gold">
          + افزودن محصول
        </Button>
      </div>

      <Card className="card-luxury">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-bold text-foreground">
            لیست محصولات ({products.length} محصول)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="text-xs uppercase bg-surface-elevated text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-start font-semibold">نام محصول</th>
                <th className="px-5 py-3.5 text-start font-semibold">دسته‌بندی</th>
                <th className="px-5 py-3.5 text-start font-semibold">قیمت (تومان)</th>
                <th className="px-5 py-3.5 text-start font-semibold">وضعیت موجودی</th>
                <th className="px-5 py-3.5 text-start font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                    محصولی در کاتالوگ ثبت نشده است
                  </td>
                </tr>
              ) : (
                products.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-foreground">
                      <div>{item.nameFa}</div>
                      <div className="text-xs text-muted-foreground font-normal">{item.nameEn || item.slugFa}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {item.category?.nameFa || 'دسته‌بندی نشده'}
                    </td>
                    <td className="px-5 py-4 font-bold text-primary">
                      {item.price ? item.price.toLocaleString('fa-IR') : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
                        {item.stockStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button className="text-xs text-primary hover:underline font-semibold">ویرایش</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
