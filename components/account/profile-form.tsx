'use client';

import { useState, useTransition } from 'react';
import { updateProfileAction } from '@/app/actions/customer-auth';

const field = 'w-full h-11 rounded-xl border border-border bg-input px-3 text-sm focus:border-primary focus:outline-none';

export function ProfileForm({ firstName, lastName, email }: { firstName: string; lastName: string; email: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3 max-w-lg"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await updateProfileAction(fd);
          setMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: 'اطلاعات ذخیره شد.' });
        });
      }}
    >
      <input type="hidden" name="next" value="/account/profile" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="firstName" defaultValue={firstName} placeholder="نام" className={field} required />
        <input name="lastName" defaultValue={lastName} placeholder="نام خانوادگی" className={field} required />
      </div>
      <input name="email" type="email" dir="ltr" defaultValue={email} placeholder="ایمیل (اختیاری)" className={field} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="h-11 px-6 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-sm disabled:opacity-60">
          ذخیره
        </button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
