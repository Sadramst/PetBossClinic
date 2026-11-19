import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { AccountShell } from '@/components/account/account-shell';
import { requireCustomer } from '@/lib/customer/session';
import { listVisits } from '@/lib/club/visits';
import { faNum } from '@/lib/club/pet-math';
import { formatJalaliDate } from '@/lib/shop/expiry';
import { formatPrice } from '@/lib/format/price';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'سوابق خدمات' };

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const customer = await requireCustomer('/account/services');
  const visits = await listVisits(customer.id, { take: 200 });
  const totalPoints = visits.reduce((n, v) => n + v.pointsAwarded, 0);

  return (
    <AccountShell customer={customer} title="سوابق خدمات">
      <p className="text-sm leading-7 text-muted-foreground">
        هر خدمتی که در کلینیک پت‌باس دریافت می‌کنید اینجا ثبت می‌شود و برایش امتیاز باشگاه می‌گیرید.
        {totalPoints > 0 && <> تا امروز <b className="text-primary">{faNum(totalPoints)}</b> امتیاز از خدمات کلینیک گرفته‌اید.</>}
      </p>
      {visits.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-border bg-surface-card p-10 text-center">
          <p className="font-bold">هنوز خدمتی برای شما ثبت نشده است.</p>
          <p className="text-sm text-muted-foreground">بعد از اولین مراجعه به کلینیک، سابقه ویزیت و امتیازتان اینجا نمایش داده می‌شود.</p>
          <Link href="/contact" className="btn btn-gold inline-flex">دریافت نوبت</Link>
        </div>
      ) : (
        <ul data-testid="services-list" className="space-y-3">
          {visits.map((v) => (
            <li key={v.id} data-testid="visit-row" className="min-w-0 space-y-2 rounded-2xl border border-border bg-surface-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-extrabold [overflow-wrap:anywhere]">{v.serviceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatJalaliDate(v.visitedAt)}
                    {v.pet && <> · <Link href={`/account/pets/${v.pet.id}`} className="text-primary hover:underline">{v.pet.name}</Link></>}
                    {v.doctor ? ` · دکتر ${v.doctor.replace(/^دکتر\s*/, '')}` : ''}
                  </p>
                </div>
                <div className="text-end text-sm">
                  {v.amount > 0 && <p className="font-bold">{formatPrice(v.amount, 'fa')}</p>}
                  {v.pointsAwarded > 0 && <p className="text-xs font-black text-primary">+{faNum(v.pointsAwarded)} امتیاز</p>}
                </div>
              </div>
              {v.notes && <p className="text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">{v.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
