import { db } from "@/lib/db";
import { ServicesManager } from "@/components/admin/services-manager";
import { SectionTabs } from "@/components/admin/section-tabs";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = 'force-dynamic';

export default async function AdminServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('VIEWER', locale);
  const isEn = locale === 'en';

  const [services, divisions] = await Promise.all([
    db.service.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        division: {
          select: { id: true, nameFa: true, nameEn: true },
        },
      },
    }),
    db.division.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, nameFa: true, nameEn: true },
    }),
  ]);

  return (
    <>
      <SectionTabs group="clinic" current="services" />
      <ServicesManager
        services={services}
        divisions={divisions}
        isEn={isEn}
      />
    </>
  );
}
