'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import { createPetAction, updatePetAction } from '@/app/actions/pets';
import { toast } from '@/components/ui/toaster';
import { useHydrated } from '@/components/account/use-hydrated';
import { SPECIES_LABEL } from '@/lib/club/pet-math';

const field = 'w-full h-11 rounded-xl border border-border bg-input px-3 text-sm focus:border-primary focus:outline-none';
const label = 'block space-y-1 text-sm';

export interface PetFormValues {
  name?: string; species?: string; breed?: string | null; sex?: string; birthDate?: string; adoptedAt?: string;
  weightKg?: number | null; neutered?: boolean | null; color?: string | null; microchip?: string | null;
  foodBrand?: string | null; allergies?: string | null; medicalNotes?: string | null;
}

export function PetForm({ petId, initial, onDone }: { petId?: string; initial?: PetFormValues; onDone?: (id?: string) => void }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const v = initial ?? {};

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const s = (k: string) => String(fd.get(k) ?? '').trim();
        const neutered = s('neutered');
        const input = {
          name: s('name'), species: s('species'), breed: s('breed') || null, sex: s('sex') || 'UNKNOWN',
          birthDate: s('birthDate') || null, adoptedAt: s('adoptedAt') || null, weightKg: s('weightKg') || null,
          neutered: neutered === '' ? null : neutered === 'yes', color: s('color') || null, microchip: s('microchip') || null,
          foodBrand: s('foodBrand') || null, allergies: s('allergies') || null, medicalNotes: s('medicalNotes') || null,
        };
        start(async () => {
          setError(null);
          const res = petId ? await updatePetAction(petId, input as never) : await createPetAction(input as never);
          if (!res.ok) return setError(res.error ?? 'ذخیره انجام نشد.');
          toast.success(petId ? 'پروفایل به‌روز شد' : 'حیوان خانگی اضافه شد', res.bonus ? `${res.bonus.toLocaleString('fa-IR')} امتیاز باشگاه هدیه گرفتید.` : undefined);
          if (onDone) onDone(res.id);
          if (!petId && res.id) router.push(`/account/pets/${res.id}`);
          else router.refresh();
        });
      }}
    >
      {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={label}>نام <span className="text-red-400">*</span>
          <input data-testid="pet-name-input" name="name" defaultValue={v.name ?? ''} maxLength={40} required className={field} autoComplete="off" />
        </label>
        <label className={label}>نوع حیوان <span className="text-red-400">*</span>
          <select name="species" defaultValue={v.species ?? 'DOG'} className={field}>
            {Object.entries(SPECIES_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>
        <label className={label}>نژاد
          <input name="breed" defaultValue={v.breed ?? ''} maxLength={40} className={field} placeholder="مثلاً شیتزو، پرشین" />
        </label>
        <label className={label}>جنسیت
          <select name="sex" defaultValue={v.sex ?? 'UNKNOWN'} className={field}>
            <option value="UNKNOWN">نامشخص</option><option value="MALE">نر</option><option value="FEMALE">ماده</option>
          </select>
        </label>
        <label className={label}>تاریخ تولد (تقریبی هم کافی است)
          <input name="birthDate" type="date" dir="ltr" defaultValue={v.birthDate ?? ''} className={`${field} text-start`} />
        </label>
        <label className={label}>تاریخ آوردن به خانه
          <input name="adoptedAt" type="date" dir="ltr" defaultValue={v.adoptedAt ?? ''} className={`${field} text-start`} />
        </label>
        <label className={label}>وزن (کیلوگرم)
          <input name="weightKg" inputMode="decimal" dir="ltr" defaultValue={v.weightKg ?? ''} className={`${field} text-start`} />
        </label>
        <label className={label}>عقیم‌سازی
          <select name="neutered" defaultValue={v.neutered == null ? '' : v.neutered ? 'yes' : 'no'} className={field}>
            <option value="">نامشخص</option><option value="yes">عقیم شده</option><option value="no">عقیم نشده</option>
          </select>
        </label>
        <label className={label}>رنگ
          <input name="color" defaultValue={v.color ?? ''} maxLength={30} className={field} />
        </label>
        <label className={label}>شماره میکروچیپ
          <input name="microchip" inputMode="numeric" dir="ltr" defaultValue={v.microchip ?? ''} maxLength={20} className={`${field} text-start`} />
        </label>
        <label className={`${label} sm:col-span-2`}>برند غذای فعلی
          <input name="foodBrand" defaultValue={v.foodBrand ?? ''} maxLength={60} className={field} placeholder="مثلاً رویال کنین" />
          <span className="text-xs text-muted-foreground">با دانستن برند غذا، پیشنهادها و تخفیف‌های مخصوص همان برند را برایتان می‌فرستیم.</span>
        </label>
        <label className={`${label} sm:col-span-2`}>حساسیت‌ها
          <input name="allergies" defaultValue={v.allergies ?? ''} maxLength={300} className={field} />
        </label>
        <label className={`${label} sm:col-span-2`}>توضیحات پزشکی
          <textarea name="medicalNotes" defaultValue={v.medicalNotes ?? ''} maxLength={1000} rows={3} className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button data-testid="pet-save" disabled={pending || !hydrated} className="h-11 rounded-xl bg-gradient-gold px-6 text-sm font-bold text-charcoal-950 disabled:opacity-60">
          {pending ? 'در حال ذخیره…' : petId ? 'ذخیره تغییرات' : 'افزودن حیوان خانگی'}
        </button>
        {onDone && <button type="button" onClick={() => onDone()} className="h-11 rounded-xl border border-border px-5 text-sm">انصراف</button>}
      </div>
    </form>
  );
}
