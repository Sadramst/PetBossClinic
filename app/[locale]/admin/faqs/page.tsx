import { db } from "@/lib/db";
import { FaqsManager } from "@/components/admin/faqs-manager";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = 'force-dynamic';

export default async function AdminFaqsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('VIEWER', locale);
  const isEn = locale === 'en';

  const [faqs, categories] = await Promise.all([
    db.faq.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        category: {
          select: { id: true, nameFa: true, nameEn: true },
        },
      },
    }),
    db.faqCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, nameFa: true, nameEn: true },
    }),
  ]);

  return (
    <FaqsManager
      faqs={faqs}
      categories={categories}
      isEn={isEn}
    />
  );
}
