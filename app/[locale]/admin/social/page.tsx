import { db } from "@/lib/db";
import { SocialManager } from "@/components/admin/social-manager";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = 'force-dynamic';

export default async function AdminSocialPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('EDITOR', locale);
  const isEn = locale === 'en';

  const socialLinks = await db.socialLink.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <SocialManager
      socialLinks={socialLinks.map((s) => ({
        id: s.id,
        platform: s.platform,
        url: s.url,
        icon: s.icon,
        isActive: s.isActive,
        sortOrder: s.sortOrder,
      }))}
      isEn={isEn}
    />
  );
}
