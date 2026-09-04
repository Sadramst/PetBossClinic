import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">تنظیمات عمومی کلینیک</h1>
        <p className="text-sm text-muted-foreground">اطلاعات تماس، نشانی جغرافیایی و ساعات کاری کلینیک پت‌باس</p>
      </div>

      <Card className="card-luxury p-6 space-y-6">
        <div>
          <h2 className="text-base font-bold text-foreground mb-4 pb-2 border-b border-border">اطلاعات پایه و هویتی</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">نام کلینیک (فارسی)</label>
              <input
                type="text"
                defaultValue="کلینیک دامپزشکی و پت شاپ پت باس"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Clinic Name (English)</label>
              <input
                type="text"
                defaultValue="Pet Boss Veterinary Clinic & Pet Shop"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-foreground text-xs outline-none focus:ring-1 focus:ring-primary dir-ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">شعار برند (فارسی)</label>
              <input
                type="text"
                defaultValue="مراقبت با عشق"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">شماره تماس اضطراری</label>
              <input
                type="text"
                defaultValue="۰۲۱-۲۲۰۰۰۰۰۰"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-foreground text-xs outline-none focus:ring-1 focus:ring-primary dir-ltr"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-base font-bold text-foreground mb-4 pb-2 border-b border-border">موقعیت مکانی و ساعات کار</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">آدرس دقیق</label>
              <input
                type="text"
                defaultValue="تهران، خیابان شریعتی، بالاتر از پل صدر، نرسیده به ایستگاه مترو قیطریه، پلاک ۱۷۳۳"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">مختصات جغرافیایی (Latitude, Longitude)</label>
                <input
                  type="text"
                  defaultValue="35.790937, 51.4350853"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-foreground text-xs outline-none focus:ring-1 focus:ring-primary dir-ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">ساعات کاری روزانه</label>
                <input
                  type="text"
                  defaultValue="۱۰:۰۰ صبح الی ۲۲:۰۰ شب (همه روزه)"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <Button className="bg-gradient-gold text-charcoal-950 font-bold rounded-xl shadow-gold text-xs px-6 py-2.5">
            ذخیره تغییرات
          </Button>
        </div>
      </Card>
    </div>
  );
}
