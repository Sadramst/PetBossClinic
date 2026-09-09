import { db } from "@/lib/db";
import { LeadsManager } from "@/components/admin/leads-manager";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = 'force-dynamic';

export default async function AdminLeadsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('VIEWER', locale);
  const isEn = locale === 'en';

  const leads = await db.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <LeadsManager
      leads={leads}
      isEn={isEn}
    />
  );
}
