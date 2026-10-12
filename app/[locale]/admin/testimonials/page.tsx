import { db } from "@/lib/db";
import { TestimonialsManager } from "@/components/admin/testimonials-manager";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = 'force-dynamic';

export default async function AdminTestimonialsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('EDITOR', locale);
  const isEn = locale === 'en';

  const testimonials = await db.testimonial.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <TestimonialsManager
      testimonials={testimonials.map((t) => ({
        id: t.id,
        nameFa: t.nameFa,
        nameEn: t.nameEn,
        contentFa: t.contentFa,
        contentEn: t.contentEn,
        rating: t.rating,
        isActive: t.isActive,
        sortOrder: t.sortOrder,
      }))}
      isEn={isEn}
    />
  );
}
