import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default async function AdminStaffPage() {
  const staff = await db.staffMember.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">کادر پزشکی و درمانی</h1>
          <p className="text-sm text-muted-foreground">مدیریت مشخصات دامپزشکان، تخصص‌ها و شماره نظام دامپزشکی</p>
        </div>
        <Button className="bg-gradient-gold text-charcoal-950 font-bold rounded-xl text-xs shadow-gold">
          + افزودن پزشک جدید
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map((member) => (
          <Card key={member.id} className="card-luxury p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-surface-elevated border border-border-gold flex items-center justify-center text-primary font-bold text-xl shadow-gold shrink-0">
                  {member.nameFa.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">{member.nameFa}</h3>
                  <p className="text-xs text-primary font-semibold">{member.titleFa}</p>
                  {member.licenseNo && (
                    <span className="text-[11px] text-muted-foreground block mt-0.5">
                      نظام: {member.licenseNo}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {member.bioFa || member.specialtyFa || 'بدون توضیحات ثبت شده'}
              </p>
            </div>
            <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className={`px-2 py-0.5 rounded-full ${
                member.isActive ? 'text-emerald-400 bg-emerald-500/15' : 'text-rose-400 bg-rose-500/15'
              }`}>
                {member.isActive ? 'فعال' : 'غیرفعال'}
              </span>
              <button className="text-primary font-bold hover:underline">ویرایش مشخصات</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
