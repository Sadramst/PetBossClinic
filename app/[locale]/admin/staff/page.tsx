import { db } from "@/lib/db";
import { StaffManager } from "@/components/admin/staff-manager";

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
    <StaffManager
      staff={staff}
      isEn={isEn}
    />
  );
}
