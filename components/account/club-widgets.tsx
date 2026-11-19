'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import { redeemRewardAction } from '@/app/actions/club';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toaster';
import { CopyButton } from '@/components/marketing/copy-button';
import { useHydrated } from '@/components/account/use-hydrated';

export function RewardRedeem({ rewardId, title, cost, disabled, reason }: { rewardId: string; title: string; cost: number; disabled: boolean; reason?: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (code) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-primary/60 bg-primary/5 px-3 py-2">
        <span dir="ltr" data-testid="reward-code" className="font-black tracking-widest [overflow-wrap:anywhere]">{code}</span>
        <CopyButton text={code} />
      </div>
    );
  }
  return (
    <>
      <button
        data-testid="reward-redeem"
        disabled={disabled || !hydrated}
        onClick={() => setOpen(true)}
        className="h-10 w-full rounded-xl bg-gradient-gold text-sm font-bold text-charcoal-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled && reason ? reason : 'دریافت جایزه'}
      </button>
      <ConfirmDialog
        open={open}
        tone="default"
        title={`دریافت «${title}»؟`}
        description={`${cost.toLocaleString('fa-IR')} امتیاز از حساب شما کم می‌شود و یک کد تخفیف اختصاصی و یک‌بارمصرف ساخته می‌شود.`}
        confirmLabel="تأیید و دریافت"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await redeemRewardAction(rewardId);
            setOpen(false);
            if (!res.ok || !res.couponCode) return void toast.error(res.error ?? 'دریافت جایزه انجام نشد.');
            setCode(res.couponCode);
            toast.success('جایزه شما آماده است', 'کد تخفیف در «کدهای تخفیف من» هم ذخیره شد.');
            router.refresh();
          })
        }
      />
    </>
  );
}

export function ReferralCard({ code, invited, converted, earned }: { code: string; invited: number; converted: number; earned: number }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/r/${code}`;
  const text = `با کد دعوت من در پت‌باس عضو شو و امتیاز هدیه بگیر: ${link}`;
  return (
    <div className="space-y-4 rounded-2xl border border-primary/40 bg-primary/5 p-4 sm:p-5">
      <div>
        <h3 className="font-extrabold">دوستانتان را دعوت کنید</h3>
        <p className="mt-1 text-sm leading-7 text-muted-foreground">وقتی دوستتان با لینک شما عضو شود و اولین سفارشش تحویل داده شود، هر دو امتیاز هدیه می‌گیرید.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-primary/50 px-3 py-2">
        <span data-testid="referral-code" dir="ltr" className="font-black tracking-widest">{code}</span>
        <span data-testid="referral-copy"><CopyButton text={link} label="کپی لینک دعوت" /></span>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('با کد دعوت من در پت‌باس عضو شو و امتیاز هدیه بگیر')}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">اشتراک در تلگرام</a>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">اشتراک در واتس‌اپ</a>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[['دعوت‌شده', invited], ['خریدکرده', converted], ['امتیاز دریافتی', earned]].map(([l, n]) => (
          <div key={l as string} className="rounded-xl border border-border bg-surface-card p-2">
            <dd className="font-black text-primary">{(n as number).toLocaleString('fa-IR')}</dd>
            <dt className="text-[11px] text-muted-foreground">{l}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
