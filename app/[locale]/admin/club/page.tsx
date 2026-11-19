import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/guard';
import { getLoyaltyConfig } from '@/lib/club/config';
import { getClubReport } from '@/lib/club/reports';
import { ClubAdmin } from '@/components/admin/club/club-admin';

export const dynamic = 'force-dynamic';

export default async function AdminClubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await requireAdmin('EDITOR', locale);
  const cfg = await getLoyaltyConfig();
  const [report, rewards] = await Promise.all([getClubReport(cfg.pointValueToman), db.reward.findMany({ orderBy: [{ sortOrder: 'asc' }, { pointsCost: 'asc' }] })]);

  return (
    <ClubAdmin
      canEditConfig={session.role === 'ADMIN' || session.role === 'SUPER_ADMIN'}
      config={{
        enabled: cfg.enabled,
        pointsPerThousandToman: cfg.pointsPerThousandToman,
        serviceMultiplier: cfg.serviceMultiplier,
        signupBonus: cfg.signupBonus,
        firstPetBonus: cfg.firstPetBonus,
        petProfileBonus: cfg.petProfileBonus,
        reviewBonus: cfg.reviewBonus,
        birthdayBonus: cfg.birthdayBonus,
        referralGiven: cfg.referralGiven,
        referralJoined: cfg.referralJoined,
        pointValueToman: cfg.pointValueToman,
        pointsExpireMonths: cfg.pointsExpireMonths ?? null,
      }}
      tiers={cfg.tiers}
      rewards={rewards.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? '',
        pointsCost: r.pointsCost,
        couponType: r.couponType,
        couponValue: r.couponValue,
        couponMaxDiscount: r.couponMaxDiscount,
        couponMinSubtotal: r.couponMinSubtotal,
        couponValidDays: r.couponValidDays,
        minTier: r.minTier ?? '',
        stock: r.stock,
        redeemedCount: r.redeemedCount,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
      }))}
      report={report}
    />
  );
}
