import { db } from "@/lib/db";
import { DivisionsManager } from "@/components/admin/divisions-manager";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = 'force-dynamic';

export default async function AdminDivisionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('VIEWER', locale);
  const isEn = locale === 'en';

  const divisions = await db.division.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: { services: true },
      },
    },
  });

  return (
    <DivisionsManager
      divisions={divisions}
      isEn={isEn}
    />
  );
}
