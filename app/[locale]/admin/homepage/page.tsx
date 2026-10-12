import { db } from "@/lib/db";
import { HomepageManager } from "@/components/admin/homepage-manager";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = 'force-dynamic';

export default async function AdminHomepageSectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('EDITOR', locale);
  const isEn = locale === 'en';

  const defaultKeys = [
    'hero',
    'divisions',
    'shop',
    'services',
    'staff',
    'testimonials',
    'faq',
    'contact',
  ];

  // Fetch all sections
  let sections = await db.homepageSection.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  // Ensure default keys exist in DB if not already present
  if (sections.length < defaultKeys.length) {
    for (let i = 0; i < defaultKeys.length; i++) {
      const key = defaultKeys[i];
      if (!sections.some((s) => s.key === key)) {
        await db.homepageSection.create({
          data: {
            key,
            sortOrder: i * 10,
            isVisible: true,
          },
        });
      }
    }
    sections = await db.homepageSection.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  return (
    <HomepageManager
      sections={sections.map((s) => ({
        id: s.id,
        key: s.key,
        titleFa: s.titleFa,
        titleEn: s.titleEn,
        subtitleFa: s.subtitleFa,
        subtitleEn: s.subtitleEn,
        eyebrowFa: s.eyebrowFa,
        eyebrowEn: s.eyebrowEn,
        badgeFa: s.badgeFa,
        badgeEn: s.badgeEn,
        ctaLabelFa: s.ctaLabelFa,
        ctaLabelEn: s.ctaLabelEn,
        ctaHref: s.ctaHref,
        isVisible: s.isVisible,
        sortOrder: s.sortOrder,
      }))}
      isEn={isEn}
    />
  );
}
