'use client';

import { useState, useTransition } from 'react';
import { updateMarketingPrefsAction } from '@/app/actions/club';
import { toast } from '@/components/ui/toaster';
import { useHydrated } from '@/components/account/use-hydrated';

export function ConsentToggle({ initial, since }: { initial: boolean; since: string | null }) {
  const [on, setOn] = useState(initial);
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-7">
        <input
          data-testid="pref-sms-consent"
          type="checkbox"
          checked={on}
          disabled={pending || !hydrated}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            start(async () => {
              const res = await updateMarketingPrefsAction(next);
              if (!res.ok) {
                setOn(!next);
                return void toast.error(res.error ?? 'ذخیره انجام نشد.');
              }
              toast.success(next ? 'پیامک‌های پیشنهادی فعال شد' : 'پیامک‌های پیشنهادی غیرفعال شد');
            });
          }}
          className="mt-1.5 size-4 shrink-0 accent-[var(--color-primary,#c9a24a)]"
        />
        <span>
          می‌خواهم پیشنهادهای ویژه، یادآوری واکسن و نوبت، تخفیف تولد حیوان خانگی و اخبار باشگاه را با پیامک دریافت کنم.
          <span className="block text-xs text-muted-foreground">
            هر زمان بخواهید می‌توانید این گزینه را خاموش کنید یا در پیامک‌ها عدد ۱ را بفرستید. پیام‌های مربوط به سفارش همیشه ارسال می‌شود.
            {since && ` آخرین تغییر: ${since}`}
          </span>
        </span>
      </label>
    </div>
  );
}
