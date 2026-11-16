'use client';

import { useEffect, useState, useTransition } from 'react';
import { requestOtpAction, updateProfileAction, verifyOtpAction } from '@/app/actions/customer-auth';

type Step = 'phone' | 'code' | 'profile';
const inputCls = 'w-full h-12 rounded-xl border border-border bg-input px-4 text-base focus:border-primary focus:outline-none';
const btnCls = 'w-full h-12 rounded-xl bg-gradient-gold text-charcoal-950 font-extrabold disabled:opacity-60';

export function LoginForm({ next, initialStep = 'phone' }: { next: string; initialStep?: Step }) {
  const [step, setStep] = useState<Step>(initialStep);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Full navigation so the server re-renders with the new session cookie.
  const go = (path: string) => window.location.assign(path);

  const sendCode = () =>
    start(async () => {
      setError(null);
      const res = await requestOtpAction(phone);
      if (res.error) return setError(res.error);
      setStep('code');
      setCooldown(60);
    });

  const verify = (value = code) =>
    start(async () => {
      setError(null);
      const res = await verifyOtpAction(phone, value, next);
      if (res.error) return setError(res.error);
      if (res.needsProfile) setStep('profile');
      else go(res.redirectTo ?? '/account');
    });

  return (
    <div className="max-w-md mx-auto rounded-3xl border border-border bg-surface-card p-6 sm:p-8 space-y-5">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black">{step === 'profile' ? 'تکمیل اطلاعات' : 'ورود یا ثبت‌نام'}</h1>
        <p className="text-sm text-muted-foreground">
          {step === 'phone' && 'شماره موبایل خود را وارد کنید تا کد ورود برایتان پیامک شود.'}
          {step === 'code' && `کد ۵ رقمی ارسال‌شده به ${phone} را وارد کنید.`}
          {step === 'profile' && 'برای ارسال سفارش، نام و نام خانوادگی خود را وارد کنید.'}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-4 py-3">
          {error}
        </p>
      )}

      {step === 'phone' && (
        <form onSubmit={(e) => (e.preventDefault(), sendCode())} className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span>شماره موبایل</span>
            <input
              className={inputCls}
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder="09121234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoFocus
            />
          </label>
          <button className={btnCls} disabled={pending}>
            {pending ? 'در حال ارسال…' : 'دریافت کد ورود'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={(e) => (e.preventDefault(), verify())} className="space-y-4">
          <input
            className={`${inputCls} text-center tracking-[0.6em] text-xl font-bold`}
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={5}
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d۰-۹]/g, '').slice(0, 5);
              setCode(v);
              if (v.length === 5) verify(v);
            }}
            aria-label="کد ورود"
            autoFocus
          />
          <button className={btnCls} disabled={pending || code.length !== 5}>
            {pending ? 'در حال بررسی…' : 'ورود'}
          </button>
          <div className="flex justify-between text-xs text-muted-foreground">
            <button type="button" onClick={() => (setStep('phone'), setCode(''))} className="hover:text-primary">
              ویرایش شماره
            </button>
            <button type="button" onClick={sendCode} disabled={cooldown > 0 || pending} className="hover:text-primary disabled:opacity-50">
              {cooldown > 0 ? `ارسال مجدد تا ${cooldown.toLocaleString('fa-IR')} ثانیه` : 'ارسال مجدد کد'}
            </button>
          </div>
        </form>
      )}

      {step === 'profile' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await updateProfileAction(fd);
              if (res.error) return setError(res.error);
              go(res.redirectTo ?? '/account');
            });
          }}
          className="space-y-4"
        >
          <input type="hidden" name="next" value={next} />
          <input className={inputCls} name="firstName" placeholder="نام" autoComplete="given-name" required />
          <input className={inputCls} name="lastName" placeholder="نام خانوادگی" autoComplete="family-name" required />
          <input className={inputCls} name="email" type="email" dir="ltr" placeholder="ایمیل (اختیاری)" autoComplete="email" />
          <button className={btnCls} disabled={pending}>
            ذخیره و ادامه
          </button>
        </form>
      )}

      <p className="text-[11px] text-center text-muted-foreground leading-6">
        با ورود به پت‌باس، قوانین فروشگاه و حریم خصوصی را می‌پذیرید. شماره شما فقط برای ورود و پیگیری سفارش استفاده می‌شود.
      </p>
    </div>
  );
}
