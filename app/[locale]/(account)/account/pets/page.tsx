import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { db } from '@/lib/db';
import { AccountShell } from '@/components/account/account-shell';
import { PetAddPanel } from '@/components/account/pet-add-panel';
import { PetAvatar } from '@/components/account/pet-avatar';
import { requireCustomer } from '@/lib/customer/session';
import { listPets, MAX_PETS } from '@/lib/club/pets';
import { openReminders } from '@/lib/club/due';
import { computeAge, dueStatus, formatAge, petCompleteness, SPECIES_LABEL } from '@/lib/club/pet-math';
import { formatJalaliDate } from '@/lib/shop/expiry';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'حیوانات خانگی من' };

export default async function PetsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const customer = await requireCustomer('/account/pets');
  const pets = await listPets(customer.id);
  const due = await db.petRecord.findMany({
    where: { petId: { in: pets.map((p) => p.id) }, kind: { not: 'WEIGHT' } },
    select: { petId: true, kind: true, title: true, nextDueAt: true, doneAt: true },
  });
  const now = new Date();
  const reminders = openReminders(due, now);

  return (
    <AccountShell customer={customer} title="حیوانات خانگی من">
      <p className="text-sm leading-7 text-muted-foreground">
        برای هر عضو خانواده یک پروفایل کامل بسازید: سوابق واکسن و درمان، وزن، برند غذا و یادآوری نوبت‌ها. با تکمیل پروفایل امتیاز باشگاه هم می‌گیرید.
      </p>

      {pets.length === 0 ? (
        <div className="space-y-2 rounded-2xl border border-border bg-surface-card p-8 text-center">
          <p className="text-3xl" aria-hidden>🐾</p>
          <p className="font-bold">هنوز حیوان خانگی‌ای ثبت نکرده‌اید.</p>
          <p className="text-sm text-muted-foreground">اولین پروفایل را بسازید و همان لحظه امتیاز هدیه بگیرید.</p>
        </div>
      ) : (
        <ul data-testid="pets-list" className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {pets.map((p) => {
            const next = reminders.find((r) => r.record.petId === p.id && r.status !== 'ok')?.record;
            const st = next ? dueStatus(next.nextDueAt, now) : 'none';
            const c = petCompleteness(p);
            return (
              <li key={p.id} data-testid="pet-card" className="min-w-0">
                <Link href={`/account/pets/${p.id}`} className="flex h-full gap-3 rounded-2xl border border-border bg-surface-card p-4 hover:border-primary">
                  <PetAvatar name={p.name} species={p.species} photoUrl={p.photoUrl} size={64} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="truncate font-extrabold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {SPECIES_LABEL[p.species]}{p.breed ? ` · ${p.breed}` : ''}{p.birthDate ? ` · ${formatAge(computeAge(p.birthDate))}` : ''}
                    </p>
                    <div className="flex items-center gap-2" aria-label={`تکمیل پروفایل ${c.percent.toLocaleString('fa-IR')} درصد`}>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"><span className="block h-full bg-primary" style={{ width: `${c.percent}%` }} /></span>
                      <span className="text-[11px] text-muted-foreground">{c.percent.toLocaleString('fa-IR')}٪</span>
                    </div>
                    {next && next.nextDueAt && st !== 'ok' && st !== 'none' && (
                      <p className={`text-xs font-bold ${st === 'overdue' ? 'text-red-400' : 'text-amber-300'}`}>
                        {next.title}: {st === 'overdue' ? 'موعد گذشته' : 'موعد'} {formatJalaliDate(next.nextDueAt)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <PetAddPanel disabledReason={pets.length >= MAX_PETS ? `حداکثر ${MAX_PETS.toLocaleString('fa-IR')} حیوان خانگی قابل ثبت است.` : undefined} />
    </AccountShell>
  );
}
