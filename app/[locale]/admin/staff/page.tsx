import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default async function AdminStaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';

  const staff = await db.staffMember.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEn ? 'Veterinary & Medical Staff' : 'کادر پزشکی و درمانی'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? 'Manage veterinarian profiles, specialties, and veterinary medical license numbers'
              : 'مدیریت مشخصات دامپزشکان، تخصص‌ها و شماره نظام دامپزشکی'}
          </p>
        </div>
        <Button className="bg-gradient-gold text-charcoal-950 font-bold rounded-xl text-xs shadow-gold">
          {isEn ? '+ Add New Veterinarian' : '+ افزودن پزشک جدید'}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map((member) => {
          const mName = isEn ? (member.nameEn || member.nameFa) : member.nameFa;
          const mTitle = isEn ? (member.titleEn || member.titleFa) : member.titleFa;
          const mBio = isEn ? (member.bioEn || member.bioFa || member.specialtyEn || member.specialtyFa) : (member.bioFa || member.specialtyFa);

          return (
            <Card key={member.id} className="card-luxury p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-surface-elevated border border-border-gold flex items-center justify-center text-primary font-bold text-xl shadow-gold shrink-0">
                    {mName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-base">{mName}</h3>
                    <p className="text-xs text-primary font-semibold">{mTitle}</p>
                    {member.licenseNo && (
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {isEn ? 'License:' : 'نظام:'} {member.licenseNo}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  {mBio || (isEn ? 'No biography provided' : 'بدون توضیحات ثبت شده')}
                </p>
              </div>
              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className={`px-2 py-0.5 rounded-full ${
                  member.isActive ? 'text-emerald-400 bg-emerald-500/15' : 'text-rose-400 bg-rose-500/15'
                }`}>
                  {member.isActive ? (isEn ? 'Active' : 'فعال') : (isEn ? 'Inactive' : 'غیرفعال')}
                </span>
                <button className="text-primary font-bold hover:underline">
                  {isEn ? 'Edit Profile' : 'ویرایش مشخصات'}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
