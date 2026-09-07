import { db } from "@/lib/db";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';

  const siteSetting = await db.siteSetting.findFirst();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isEn ? 'General Clinic Settings' : 'تنظیمات عمومی کلینیک'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEn
            ? 'Contact details, geolocation, working hours, and physical clinic parameters'
            : 'اطلاعات تماس، نشانی پستی، مختصات جغرافیایی و ساعات کاری کلینیک پت‌باس'}
        </p>
      </div>

      <SettingsForm
        initialSettings={siteSetting}
        isEn={isEn}
      />
    </div>
  );
}
