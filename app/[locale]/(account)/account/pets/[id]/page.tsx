import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { db } from '@/lib/db';
import { AccountShell } from '@/components/account/account-shell';
import { PetAvatar } from '@/components/account/pet-avatar';
import { WeightChart } from '@/components/account/weight-chart';
import { PetDeleteButton, PetEditPanel, PetPhotoControl, PetRecordForm, RecordDeleteButton } from '@/components/account/pet-profile-actions';
import { requireCustomer } from '@/lib/customer/session';
import { getPetFor } from '@/lib/club/pets';
import { getLoyaltyConfig } from '@/lib/club/config';
import { openReminders } from '@/lib/club/due';
import { listVisits } from '@/lib/club/visits';
import { computeAge, daysUntil, faNum, formatAge, petCompleteness, RECORD_KIND_LABEL, SEX_LABEL, SPECIES_LABEL, weightTrend } from '@/lib/club/pet-math';
import { formatJalaliDate } from '@/lib/shop/expiry';
import { formatPrice } from '@/lib/format/price';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'پروفایل حیوان خانگی' };

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : undefined);

export default async function PetProfilePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const customer = await requireCustomer(`/account/pets/${id}`);
  // Scoped by owner: somebody else's pet id is simply "not found".
  const pet = await getPetFor(customer.id, id);
  if (!pet || !pet.isActive) notFound();

  const [records, visits, config] = await Promise.all([
    db.petRecord.findMany({ where: { petId: pet.id }, orderBy: { doneAt: 'desc' }, take: 200 }),
    listVisits(customer.id, { petId: pet.id, take: 50 }),
    getLoyaltyConfig(),
  ]);
  const now = new Date();
  const completeness = petCompleteness(pet);
  const trend = weightTrend(records);
  const reminders = openReminders(records.filter((r) => r.kind !== 'WEIGHT'), now);
  const dueByRecord = new Map(reminders.map((r) => [r.record.id, r.status]));
  const species = pet.species === 'DOG' ? 'dog' : pet.species === 'CAT' ? 'cat' : null;
  const shopQuery = new URLSearchParams({ ...(species ? { pet: species } : {}), ...(pet.foodBrand ? { q: pet.foodBrand } : {}) }).toString();
  const lastWeight = pet.weightKg ?? trend.points[trend.points.length - 1]?.kg ?? null;

  return (
    <AccountShell customer={customer} title="پروفایل حیوان خانگی">
      <div data-testid="pet-profile" className="space-y-5">
        <Link href="/account/pets" className="text-sm text-muted-foreground hover:text-primary">← همه حیوانات من</Link>

        <section className="flex flex-wrap items-start gap-4 rounded-2xl border border-border bg-surface-card p-4 sm:p-5">
          <PetAvatar name={pet.name} species={pet.species} photoUrl={pet.photoUrl} size={104} />
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-2xl font-black [overflow-wrap:anywhere]">{pet.name}</h2>
            <p className="text-sm text-muted-foreground">
              {SPECIES_LABEL[pet.species]}{pet.breed ? ` · ${pet.breed}` : ''} · {SEX_LABEL[pet.sex]}
              {pet.birthDate ? ` · ${formatAge(computeAge(pet.birthDate))}` : ''}
            </p>
            <PetPhotoControl petId={pet.id} hasPhoto={!!pet.photoUrl} />
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/shop${shopQuery ? `?${shopQuery}` : ''}`} className="btn btn-gold btn-sm">محصولات مناسب {pet.name}</Link>
            </div>
          </div>
        </section>

        <section data-testid="pet-completeness" className="space-y-2 rounded-2xl border border-border bg-surface-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold">تکمیل پروفایل</h3>
            <span className="font-black text-primary">{faNum(completeness.percent)}٪</span>
          </div>
          <div role="progressbar" aria-valuenow={completeness.percent} aria-valuemin={0} aria-valuemax={100} aria-label="تکمیل پروفایل" className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-gradient-gold" style={{ width: `${completeness.percent}%` }} />
          </div>
          {completeness.missing.length > 0 && <p className="text-xs leading-6 text-muted-foreground">برای دقیق‌تر شدن پیشنهادها اضافه کنید: {completeness.missing.join('، ')}.</p>}
          <p className="text-xs leading-6 text-muted-foreground">
            {completeness.bonusEligible
              ? 'پروفایل کامل است و امتیاز تکمیل آن به حساب شما رسیده است.'
              : `با ثبت نژاد، تاریخ تولد و عکس یا وزن، ${faNum(config.petProfileBonus)} امتیاز باشگاه هدیه می‌گیرید.`}
          </p>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-2xl border border-border bg-surface-card p-4">
            <h3 className="font-bold">مشخصات</h3>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">وزن</dt><dd>{lastWeight ? `${faNum(lastWeight)} کیلوگرم` : '—'}</dd>
              <dt className="text-muted-foreground">عقیم‌سازی</dt><dd>{pet.neutered == null ? '—' : pet.neutered ? 'عقیم شده' : 'عقیم نشده'}</dd>
              <dt className="text-muted-foreground">رنگ</dt><dd>{pet.color || '—'}</dd>
              <dt className="text-muted-foreground">میکروچیپ</dt><dd dir="ltr" className="text-start">{pet.microchip || '—'}</dd>
              <dt className="text-muted-foreground">تاریخ تولد</dt><dd>{pet.birthDate ? formatJalaliDate(pet.birthDate) : '—'}</dd>
              <dt className="text-muted-foreground">آمدن به خانه</dt><dd>{pet.adoptedAt ? formatJalaliDate(pet.adoptedAt) : '—'}</dd>
              <dt className="text-muted-foreground">برند غذا</dt><dd>{pet.foodBrand || '—'}</dd>
            </dl>
          </div>
          <div className="space-y-2 rounded-2xl border border-border bg-surface-card p-4">
            <h3 className="font-bold">سلامت</h3>
            <p className="text-sm"><span className="text-muted-foreground">حساسیت‌ها: </span>{pet.allergies || 'ثبت نشده'}</p>
            <p className="whitespace-pre-line text-sm leading-7"><span className="text-muted-foreground">توضیحات پزشکی: </span>{pet.medicalNotes || 'ثبت نشده'}</p>
            {trend.points.length >= 2 && (
              <div className="space-y-1 pt-1">
                <WeightChart points={trend.points} />
                {trend.delta != null && <p className="text-xs text-muted-foreground">آخرین تغییر وزن: {trend.delta > 0 ? '+' : ''}{faNum(Math.round(trend.delta * 100) / 100)} کیلوگرم</p>}
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="timeline" className="space-y-3">
          <h3 id="timeline" className="text-lg font-extrabold">سوابق سلامت</h3>
          {records.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface-card p-6 text-center text-sm text-muted-foreground">هنوز سابقه‌ای ثبت نشده. واکسن‌ها و درمان‌ها را اضافه کنید تا موعد بعدی را به شما یادآوری کنیم.</p>
          ) : (
            <ol className="space-y-2">
              {records.map((r) => {
                const st = dueByRecord.get(r.id);
                const days = r.nextDueAt ? daysUntil(r.nextDueAt, now) : null;
                return (
                  <li key={r.id} data-testid="pet-record-row" className="flex items-start gap-3 rounded-2xl border border-border bg-surface-card p-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{RECORD_KIND_LABEL[r.kind]}</span>
                        <b className="[overflow-wrap:anywhere]">{r.title}</b>
                        {r.valueNumber != null && r.kind === 'WEIGHT' && <span>{faNum(r.valueNumber)} کیلوگرم</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatJalaliDate(r.doneAt)}{r.source !== 'customer' ? ' · ثبت‌شده توسط کلینیک' : ''}
                      </p>
                      {r.notes && <p className="text-xs leading-6 text-muted-foreground [overflow-wrap:anywhere]">{r.notes}</p>}
                      {r.nextDueAt && st && (
                        <p className={`text-xs font-bold ${st === 'overdue' ? 'text-red-400' : st === 'soon' ? 'text-amber-300' : 'text-emerald-400'}`}>
                          موعد بعدی: {formatJalaliDate(r.nextDueAt)}
                          {st === 'overdue' ? ' (گذشته)' : days != null && st === 'soon' ? ` (${faNum(Math.max(0, days))} روز دیگر)` : ''}
                        </p>
                      )}
                    </div>
                    {r.source === 'customer' && <RecordDeleteButton recordId={r.id} petId={pet.id} />}
                  </li>
                );
              })}
            </ol>
          )}
          <PetRecordForm petId={pet.id} />
        </section>

        <section aria-labelledby="visits" className="space-y-3">
          <h3 id="visits" className="text-lg font-extrabold">ویزیت‌ها و خدمات کلینیک</h3>
          {visits.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface-card p-6 text-center text-sm text-muted-foreground">خدمتی برای {pet.name} در کلینیک ثبت نشده است.</p>
          ) : (
            <ul className="space-y-2">
              {visits.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface-card p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-bold [overflow-wrap:anywhere]">{v.serviceName}</p>
                    <p className="text-xs text-muted-foreground">{formatJalaliDate(v.visitedAt)}{v.doctor ? ` · ${v.doctor}` : ''}</p>
                  </div>
                  <div className="text-end text-xs">
                    {v.amount > 0 && <p>{formatPrice(v.amount, 'fa')}</p>}
                    {v.pointsAwarded > 0 && <p className="font-bold text-primary">+{faNum(v.pointsAwarded)} امتیاز</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-3 border-t border-border pt-4">
          <PetEditPanel
            petId={pet.id}
            initial={{
              name: pet.name, species: pet.species, breed: pet.breed, sex: pet.sex, birthDate: iso(pet.birthDate), adoptedAt: iso(pet.adoptedAt),
              weightKg: pet.weightKg, neutered: pet.neutered, color: pet.color, microchip: pet.microchip, foodBrand: pet.foodBrand,
              allergies: pet.allergies, medicalNotes: pet.medicalNotes,
            }}
          />
          <div><PetDeleteButton petId={pet.id} name={pet.name} /></div>
        </div>
      </div>
    </AccountShell>
  );
}
