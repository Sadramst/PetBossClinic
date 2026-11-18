import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { db } from '@/lib/db';
import { AccountShell } from '@/components/account/account-shell';
import { PetAvatar } from '@/components/account/pet-avatar';
import { ProfileForm } from '@/components/account/profile-form';
import { requireCustomer } from '@/lib/customer/session';
import { formatPrice } from '@/lib/format/price';
import { formatJalaliDate } from '@/lib/shop/expiry';
import { ORDER_STATUS_FA } from '@/lib/shop/orders';
import { getMyCoupons, getUnusedWelcomeCode } from '@/lib/marketing/my-coupons';
import { CopyButton } from '@/components/marketing/copy-button';
import { getLoyaltyConfig } from '@/lib/club/config';
import { listPets } from '@/lib/club/pets';
import { openReminders } from '@/lib/club/due';
import { computeAge, daysUntil, faNum, formatAge, SPECIES_LABEL } from '@/lib/club/pet-math';
import { tierProgress } from '@/lib/club/tiers';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'داشبورد باشگاه' };

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const customer = await requireCustomer('/account');

  const [welcomeCode, config, pets, orders, coupons] = await Promise.all([
    getUnusedWelcomeCode(customer).catch(() => null),
    getLoyaltyConfig(),
    listPets(customer.id),
    db.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, number: true, status: true, total: true, createdAt: true },
    }),
    getMyCoupons(customer).catch(() => []),
  ]);
  const records = await db.petRecord.findMany({
    where: { petId: { in: pets.map((p) => p.id) }, kind: { not: 'WEIGHT' } },
    select: { id: true, petId: true, kind: true, title: true, doneAt: true, nextDueAt: true },
  });
  const now = new Date();
  const petName = new Map(pets.map((p) => [p.id, p.name]));
  const reminders = openReminders(records, now, 45).filter((r) => r.status === 'overdue' || r.status === 'soon').slice(0, 5);
  const progress = tierProgress(config.tiers, customer.lifetimePoints);
  const available = coupons.filter((c) => c.status === 'available');
  const name = customer.firstName || 'دوست پت‌باسی';

  return (
    <AccountShell customer={customer} title="داشبورد باشگاه">
      {!customer.firstName && (
        <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <p className="text-sm font-bold">برای ارسال سفارش، نام خود را تکمیل کنید.</p>
          <ProfileForm firstName="" lastName="" email="" />
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 to-transparent p-5">
        <p className="font-bold">سلام {name}، خوش آمدید.</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">امتیاز باشگاه</p>
            <p data-testid="club-points" className="text-3xl font-black text-gradient-gold">{customer.pointsBalance.toLocaleString("fa-IR")}</p>
          </div>
          <span data-testid="club-tier" className="rounded-full border px-3 py-1 text-sm font-black" style={{ borderColor: progress.current.color, color: progress.current.color }}>
            سطح {progress.current.label}
          </span>
        </div>
        <div className="space-y-1.5">
          <div data-testid="club-progress" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت تا سطح بعدی" className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-gradient-gold" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress.next ? `${faNum(progress.remaining)} امتیاز تا سطح ${progress.next.label}` : 'شما در بالاترین سطح باشگاه هستید.'} · {progress.current.perk}
          </p>
        </div>
        <Link href="/account/club" className="btn btn-gold btn-sm inline-flex">جوایز و تاریخچه امتیاز</Link>
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['حیوان خانگی', faNum(pets.length)],
          ['سفارش تحویل‌شده', faNum(customer.ordersCount)],
          ['مجموع خرید', formatPrice(customer.totalSpent, 'fa')],
          ['کد تخفیف فعال', faNum(available.length)],
        ].map(([l, v]) => (
          <div key={l} className="min-w-0 rounded-2xl border border-border bg-surface-card p-3 text-center">
            <dd className="truncate font-black">{v}</dd>
            <dt className="text-[11px] text-muted-foreground">{l}</dt>
          </div>
        ))}
      </dl>

      {welcomeCode && (
        <div data-testid="welcome-banner" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-bold">کد تخفیف خوش‌آمدگویی شما هنوز استفاده نشده است.</p>
            <p dir="ltr" className="text-start font-black tracking-widest text-primary [overflow-wrap:anywhere]">{welcomeCode}</p>
          </div>
          <div className="flex gap-2">
            <CopyButton text={welcomeCode} />
            <Link href="/account/coupons" className="btn btn-gold btn-sm">کدهای من</Link>
          </div>
        </div>
      )}

      {reminders.length > 0 && (
        <section aria-labelledby="reminders" className="space-y-2">
          <h2 id="reminders" className="text-lg font-extrabold">یادآوری‌های سلامت</h2>
          <ul className="space-y-2">
            {reminders.map(({ record: r, status }) => (
              <li key={r.id} data-testid="dashboard-reminder">
                <Link href={`/account/pets/${r.petId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface-card p-3 text-sm hover:border-primary">
                  <span className="min-w-0 [overflow-wrap:anywhere]"><b>{petName.get(r.petId)}</b> · {r.title}</span>
                  <span className={`text-xs font-bold ${status === 'overdue' ? 'text-red-400' : 'text-amber-300'}`}>
                    {status === 'overdue' ? 'موعد گذشته' : `${faNum(Math.max(0, daysUntil(r.nextDueAt!, now)))} روز دیگر`} · {formatJalaliDate(r.nextDueAt!)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="pets" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="pets" className="text-lg font-extrabold">حیوانات خانگی من</h2>
          <Link href="/account/pets" className="text-sm text-primary hover:underline">مدیریت</Link>
        </div>
        {pets.length === 0 ? (
          <div className="space-y-2 rounded-2xl border border-dashed border-primary/50 bg-surface-card p-5 text-center">
            <p className="font-bold">اولین حیوان خانگی‌تان را ثبت کنید.</p>
            <p className="text-sm text-muted-foreground">با ثبت پروفایل امتیاز هدیه می‌گیرید و یادآوری واکسن و پیشنهادهای مناسب او را دریافت می‌کنید.</p>
            <Link href="/account/pets" className="btn btn-gold btn-sm inline-flex">افزودن حیوان خانگی</Link>
          </div>
        ) : (
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {pets.map((p) => (
              <li key={p.id} className="shrink-0">
                <Link href={`/account/pets/${p.id}`} className="flex w-44 items-center gap-3 rounded-2xl border border-border bg-surface-card p-3 hover:border-primary">
                  <PetAvatar name={p.name} species={p.species} photoUrl={p.photoUrl} size={48} />
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{p.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{p.birthDate ? formatAge(computeAge(p.birthDate)) : SPECIES_LABEL[p.species]}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {available.length > 0 && (
        <section aria-labelledby="coupons" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 id="coupons" className="text-lg font-extrabold">کدهای تخفیف شما</h2>
            <Link href="/account/coupons" className="text-sm text-primary hover:underline">همه</Link>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {available.slice(0, 4).map((c) => (
              <li key={c.id} className="flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-border bg-surface-card p-3">
                <span className="min-w-0"><span className="block truncate text-sm font-bold">{c.offer}</span><span dir="ltr" className="block truncate text-start text-xs tracking-widest text-muted-foreground">{c.code}</span></span>
                <CopyButton text={c.code} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="orders" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="orders" className="text-lg font-extrabold">آخرین سفارش‌ها</h2>
          <Link href="/account/orders" className="text-sm text-primary hover:underline">همه سفارش‌ها</Link>
        </div>
        {orders.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-border bg-surface-card p-6 text-center">
            <p className="font-bold">هنوز سفارشی ثبت نکرده‌اید.</p>
            <Link href="/shop" className="btn btn-gold btn-sm inline-flex">رفتن به پت‌شاپ</Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.number}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface-card p-3 hover:border-primary">
                  <span><b dir="ltr">{o.number}</b><span className="ms-2 text-xs text-muted-foreground">{formatJalaliDate(o.createdAt)}</span></span>
                  <span className="text-xs">{ORDER_STATUS_FA[o.status]}</span>
                  <span className="font-bold text-gradient-gold">{formatPrice(o.total, 'fa')}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AccountShell>
  );
}
