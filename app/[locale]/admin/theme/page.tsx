import { requireAdmin } from '@/lib/auth/guard';
import { ThemeStudio } from '@/components/admin/theme-studio';

export const dynamic = 'force-dynamic';

export default async function AdminThemePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('VIEWER', locale);

  return <ThemeStudio />;
}
