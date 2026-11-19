import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/guard';
import { getLoyaltyConfig } from '@/lib/club/config';
import { countSegment, normalizeRules } from '@/lib/club/segments';
import { SegmentsManager } from '@/components/admin/club/segments-manager';

export const dynamic = 'force-dynamic';

export default async function AdminSegmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAdmin('EDITOR', locale);
  const [segments, cfg] = await Promise.all([db.segment.findMany({ orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }], take: 100 }), getLoyaltyConfig()]);
  const rows = await Promise.all(
    segments.map(async (s) => {
      const rules = normalizeRules(s.rules);
      return { id: s.id, name: s.name, description: s.description ?? '', isPinned: s.isPinned, rules, count: await countSegment(rules).catch(() => 0) };
    })
  );
  return <SegmentsManager segments={rows} tiers={cfg.tiers.map((t) => ({ key: t.key, label: t.label }))} />;
}
