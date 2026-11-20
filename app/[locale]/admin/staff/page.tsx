import { db } from "@/lib/db";
import { StaffManager } from "@/components/admin/staff-manager";
import { SectionTabs } from "@/components/admin/section-tabs";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = 'force-dynamic';

export default async function AdminStaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('VIEWER', locale);
  const isEn = locale === 'en';

  const staff = await db.staffMember.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <>
      <SectionTabs group="clinic" current="staff" />
      <StaffManager
        staff={staff}
        isEn={isEn}
      />
    </>
  );
}
