'use client';

import { useState, useTransition } from 'react';
import { updateProfileAction } from '@/app/actions/customer-auth';
import { toast } from '@/components/ui/toaster';

const field = 'w-full h-11 rounded-xl border border-border bg-input px-3 text-sm focus:border-primary focus:outline-none';

export interface ProfileExtras {
  birthDate: string;
  city: string;
  gender: string;
}

export function ProfileForm({ firstName, lastName, email, extras }: { firstName: string; lastName: string; email: string; extras?: ProfileExtras }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      className="space-y-3 max-w-lg"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await updateProfileAction(fd);
          if (res.error) setMsg({ ok: false, text: res.error });
          else {
            setMsg(null);
            // A toast outlives the re-render the saved profile triggers, so the confirmation is never lost.
            toast.success('اطلاعات ذخیره شد.');
          }
        });
      }}
    >
      <input type="hidden" name="next" value="/account/profile" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="firstName" defaultValue={firstName} placeholder="نام" className={field} required />
        <input name="lastName" defaultValue={lastName} placeholder="نام خانوادگی" className={field} required />
      </div>
      <input name="email" type="email" dir="ltr" defaultValue={email} aria-label="ایمیل (اختیاری)" placeholder="ایمیل (اختیاری)" className={field} />
      {extras && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block space-y-1 text-sm">تاریخ تولد
            <input name="birthDate" type="date" dir="ltr" defaultValue={extras.birthDate} className={`${field} text-start`} />
          </label>
          <label className="block space-y-1 text-sm">شهر
            <input name="city" defaultValue={extras.city} maxLength={40} className={field} />
          </label>
          <label className="block space-y-1 text-sm">جنسیت
            <select name="gender" defaultValue={extras.gender} className={field}>
              <option value="">ترجیح می‌دهم نگویم</option>
              <option value="MALE">مرد</option>
              <option value="FEMALE">زن</option>
              <option value="OTHER">سایر</option>
            </select>
          </label>
          <p className="text-xs leading-6 text-muted-foreground sm:col-span-3">با ثبت تاریخ تولد، در روز تولدتان هدیه باشگاه می‌گیرید.</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button disabled={pending} className="h-11 px-6 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-sm disabled:opacity-60">
          ذخیره
        </button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
