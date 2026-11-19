import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { AccountShell } from '@/components/account/account-shell';
import { ReferralCard, RewardRedeem } from '@/components/account/club-widgets';
import { requireCustomer } from '@/lib/customer/session';
import { getLoyaltyConfig } from '@/lib/club/config';
import { getPointsLedger } from '@/lib/club/points';
import { ensureReferralCode, getReferralStats } from '@/lib/club/referrals';
import { listRewards } from '@/lib/club/rewards';
import { POINTS_KIND_LABEL } from '@/lib/club/labels';
import { tierByKey, tierProgress, tierRank, pointsToToman } from '@/lib/club/tiers';
import { formatJalaliDate } from '@/lib/shop/expiry';
import { formatPrice } from '@/lib/format/price';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'باشگاه مشتریان' };

const fa = (n: number) => n.toLocaleString('fa-IR');
type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function ClubPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale);
  const customer = await requireCustomer('/account/club');
  const sp = await searchParams;
  const f = sp.f === 'in' || sp.f === 'out' ? sp.f : undefined;
  const pageNo = Math.max(1, Math.floor(Number(Array.isArray(sp.page) ? sp.page[0] : sp.page)) || 1);

  const [config, rewards, ledger, code, stats] = await Promise.all([
    getLoyaltyConfig(),
    listRewards(),
    getPointsLedger(customer.id, { direction: f, page: pageNo, pageSize: 15 }),
    ensureReferralCode(customer.id).catch(() => null),
    getReferralStats(customer.id),
  ]);
  const tiers = config.tiers;
  const progress = tierProgress(tiers, customer.lifetimePoints);
  const myRank = tierRank(tiers, customer.tier);
  const href = (q: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) u.set(k, String(v));
    const s = u.toString();
    return `/account/club${s ? `?${s}` : ''}`;
  };

  const earn: Array<[string, string]> = [
    ['هر ۱٬۰۰۰ تومان خرید از پت‌شاپ', `${fa(config.pointsPerThousandToman)} امتیاز`],
    ['هر ۱٬۰۰۰ تومان خدمات کلینیک', `${fa(Math.round(config.pointsPerThousandToman * config.serviceMultiplier * 10) / 10)} امتیاز`],
    ['ثبت اولین حیوان خانگی', `${fa(config.firstPetBonus)} امتیاز`],
    ['تکمیل پروفایل هر حیوان', `${fa(config.petProfileBonus)} امتیاز`],
    ['دعوت از دوستان (پس از اولین خرید او)', `${fa(config.referralGiven)} امتیاز`],
    ['ثبت نظر برای محصول', `${fa(config.reviewBonus)} امتیاز`],
    ['هدیه تولد', `${fa(config.birthdayBonus)} امتیاز`],
  ];

  return (
    <AccountShell customer={customer} title="باشگاه مشتریان">
      {!config.enabled && <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">امتیازدهی باشگاه موقتاً متوقف است.</p>}

      <section className="space-y-4 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 to-transparent p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">موجودی امتیاز شما</p>
            <p data-testid="club-points" className="text-4xl font-black text-gradient-gold">{fa(customer.pointsBalance)}</p>
            <p className="text-xs text-muted-foreground">ارزش تقریبی: {formatPrice(pointsToToman(customer.pointsBalance, config.pointValueToman), 'fa')}</p>
          </div>
          <span data-testid="club-tier" className="rounded-full border px-4 py-1.5 text-sm font-black" style={{ borderColor: progress.current.color, color: progress.current.color }}>
            سطح {progress.current.label}
          </span>
        </div>
        <div className="space-y-1.5">
          <div data-testid="club-progress" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت تا سطح بعدی" className="h-2.5 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-gradient-gold" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress.next ? `${fa(progress.remaining)} امتیاز تا سطح ${progress.next.label}` : 'شما در بالاترین سطح باشگاه هستید.'}
          </p>
        </div>
      </section>

      <section aria-labelledby="tiers" className="space-y-3">
        <h2 id="tiers" className="text-lg font-extrabold">سطح‌ها و مزایا</h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tiers.map((t, i) => (
            <li key={t.key} aria-current={t.key === customer.tier ? 'step' : undefined} className={`space-y-1 rounded-2xl border p-4 ${t.key === customer.tier ? 'border-primary bg-primary/5' : 'border-border bg-surface-card'}`}>
              <p className="flex items-center gap-2 font-black">
                <span className="inline-block size-3 rounded-full" style={{ background: t.color }} aria-hidden />
                {t.label}
                {i <= myRank && <span className="text-[11px] font-bold text-emerald-400">{i === myRank ? 'سطح فعلی' : 'رسیده‌اید'}</span>}
              </p>
              <p className="text-xs text-muted-foreground">از {fa(t.minPoints)} امتیاز کل</p>
              <p className="text-sm leading-7">{t.perk}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="earn" className="space-y-3">
        <h2 id="earn" className="text-lg font-extrabold">چطور امتیاز بگیرم؟</h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface-card">
          {earn.map(([l, v]) => (
            <li key={l} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span>{l}</span><b className="shrink-0 text-primary">{v}</b></li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">امتیاز خرید پس از تحویل سفارش ثبت می‌شود و با ارتقای سطح، ضریب امتیاز شما بیشتر هم می‌شود.</p>
      </section>

      <section aria-labelledby="rewards" className="space-y-3">
        <h2 id="rewards" className="text-lg font-extrabold">جوایز باشگاه</h2>
        {rewards.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface-card p-6 text-center text-sm text-muted-foreground">جوایز به‌زودی اضافه می‌شود. امتیازهایتان محفوظ است.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rewards.map((r) => {
              const tierLocked = !!r.minTier && tierRank(tiers, r.minTier) > myRank;
              const soldOut = r.stock != null && r.redeemedCount >= r.stock;
              const short = customer.pointsBalance < r.pointsCost;
              const reason = tierLocked ? `ویژه سطح ${tierByKey(tiers, r.minTier).label}` : soldOut ? 'تمام شد' : short ? `${fa(r.pointsCost - customer.pointsBalance)} امتیاز کم دارید` : undefined;
              return (
                <li key={r.id} data-testid="reward-card" className="min-w-0 space-y-3 rounded-2xl border border-border bg-surface-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-extrabold [overflow-wrap:anywhere]">{r.title}</h3>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-black text-primary">{fa(r.pointsCost)} امتیاز</span>
                  </div>
                  {r.description && <p className="text-sm leading-7 text-muted-foreground">{r.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    {r.couponType === 'PERCENT' ? `${fa(r.couponValue)}٪ تخفیف` : formatPrice(r.couponValue, 'fa') + ' تخفیف'}
                    {r.couponMinSubtotal > 0 ? ` · حداقل خرید ${formatPrice(r.couponMinSubtotal, 'fa')}` : ''} · اعتبار {fa(r.couponValidDays)} روز
                  </p>
                  <RewardRedeem rewardId={r.id} title={r.title} cost={r.pointsCost} disabled={!!reason} reason={reason} />
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs"><Link href="/account/coupons" className="text-primary hover:underline">مشاهده کدهای تخفیف من</Link></p>
      </section>

      {code && <ReferralCard code={code} invited={stats.invited} converted={stats.converted} earned={stats.earnedPoints} />}

      <section aria-labelledby="history" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="history" className="text-lg font-extrabold">تاریخچه امتیازها</h2>
          <nav aria-label="فیلتر تاریخچه" className="flex gap-1 text-xs">
            {[[undefined, 'همه'], ['in', 'دریافتی'], ['out', 'مصرفی']].map(([k, l]) => (
              <Link key={l as string} href={href({ f: k })} aria-current={f === k ? 'true' : undefined} className={`rounded-full border px-3 py-1 ${f === k ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{l}</Link>
            ))}
          </nav>
        </div>
        {ledger.rows.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface-card p-6 text-center text-sm text-muted-foreground">هنوز تراکنشی ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface-card">
            {ledger.rows.map((t) => (
              <li key={t.id} data-testid="points-history-row" className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-bold">{POINTS_KIND_LABEL[t.kind] ?? t.kind}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatJalaliDate(t.createdAt)}{t.note ? ` · ${t.note}` : ''}</p>
                </div>
                <b dir="ltr" className={`shrink-0 ${t.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{t.points > 0 ? '+' : ''}{fa(t.points)}</b>
              </li>
            ))}
          </ul>
        )}
        {ledger.pages > 1 && (
          <nav aria-label="صفحه‌بندی" className="flex items-center justify-center gap-3 text-sm">
            {ledger.page > 1 && <Link href={href({ f, page: ledger.page - 1 })} className="btn btn-outline btn-sm">قبلی</Link>}
            <span className="text-muted-foreground">{fa(ledger.page)} از {fa(ledger.pages)}</span>
            {ledger.page < ledger.pages && <Link href={href({ f, page: ledger.page + 1 })} className="btn btn-outline btn-sm">بعدی</Link>}
          </nav>
        )}
      </section>
    </AccountShell>
  );
}
