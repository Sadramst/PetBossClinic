import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default async function AdminFaqsPage() {
  const faqs = await db.faq.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { category: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مدیریت سوالات متداول</h1>
          <p className="text-sm text-muted-foreground">پرسش‌ها و پاسخ‌های پرتکرار مراجعین کلینیک</p>
        </div>
        <Button className="bg-gradient-gold text-charcoal-950 font-bold rounded-xl text-xs shadow-gold">
          + افزودن پرسش جدید
        </Button>
      </div>

      <div className="space-y-4">
        {faqs.map((item) => (
          <Card key={item.id} className="card-luxury p-5">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                  ؟
                </span>
                <h3 className="font-bold text-foreground text-sm">{item.questionFa}</h3>
              </div>
              <span className="text-[11px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full shrink-0 font-medium">
                {item.category?.nameFa || 'عمومی'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed ps-8">
              {item.answerFa}
            </p>
            <div className="pt-3 border-t border-border mt-3 ps-8 flex justify-end gap-3 text-xs">
              <button className="text-primary font-bold hover:underline">ویرایش</button>
              <button className="text-rose-400 hover:underline">حذف</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
