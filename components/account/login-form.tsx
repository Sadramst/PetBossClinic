'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  loginWithPasswordAction,
  registerWithPasswordAction,
  requestOtpAction,
  updateProfileAction,
  verifyOtpAction,
  type CustomerAuthState,
} from '@/app/actions/customer-auth';
import { Link } from '@/i18n/routing';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useHydrated } from '@/components/account/use-hydrated';

export type LoginMode = 'password' | 'sms' | 'register' | 'profile';
type SmsStep = 'phone' | 'code';

const PASSWORD_HINT = 'حداقل ۸ نویسه و نه فقط عدد.';

/** Password input with a show/hide toggle (long Persian/Latin passwords are easy to mistype). */
function PasswordField({
  label,
  name,
  autoComplete,
  hint,
  error,
}: {
  label: string;
  name: string;
  autoComplete: 'current-password' | 'new-password';
  hint?: string;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint} error={error} required>
      <div className="relative">
        <Input
          name={name}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          dir="auto"
          className="pe-16"
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          className="absolute inset-y-0 end-0 px-4 text-xs font-bold text-primary"
        >
          {show ? 'پنهان' : 'نمایش'}
        </button>
      </div>
    </Field>
  );
}

const MODES: { id: LoginMode; label: string }[] = [
  { id: 'password', label: 'ورود با رمز عبور' },
  { id: 'sms', label: 'ورود با کد پیامکی' },
  { id: 'register', label: 'ثبت‌نام' },
];

export function LoginForm({
  next,
  initialMode = 'password',
  smsEnabled = false,
  supportPhone,
}: {
  next: string;
  initialMode?: LoginMode;
  /** An SMS provider is configured: offer sign-in with a one-time code. */
  smsEnabled?: boolean;
  supportPhone?: string;
}) {
  const [mode, setMode] = useState<LoginMode>(initialMode === 'sms' && !smsEnabled ? 'password' : initialMode);
  const [smsStep, setSmsStep] = useState<SmsStep>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();
  // Submit buttons stay disabled until hydration (see useHydrated).
  const notReady = !useHydrated();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Full navigation so every server component re-renders with the new session cookie.
  const go = (path: string) => window.location.assign(path);

  /** Runs a sign-in style action and moves on: error → show it, new customer → profile step, else redirect. */
  const submit = (action: (fd: FormData) => Promise<CustomerAuthState>) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('next', next);
    start(async () => {
      setError(null);
      const res = await action(fd);
      if (res.error) return setError(res.error);
      if (res.needsProfile) return setMode('profile');
      go(res.redirectTo ?? '/account');
    });
  };

  const switchMode = (m: LoginMode) => {
    setMode(m);
    setError(null);
    setSmsStep('phone');
    setCode('');
  };

  const sendCode = () =>
    start(async () => {
      setError(null);
      const res = await requestOtpAction(phone);
      if (res.error) {
        if (res.retryAfter) setCooldown(res.retryAfter);
        return setError(res.error);
      }
      setSmsStep('code');
      setCooldown(60);
    });

  const verifyCode = (value = code) =>
    start(async () => {
      setError(null);
      const res = await verifyOtpAction(phone, value, next);
      if (res.error) return setError(res.error);
      if (res.needsProfile) setMode('profile');
      else go(res.redirectTo ?? '/account');
    });

  const heading =
    mode === 'profile' ? 'تکمیل اطلاعات' : mode === 'register' ? 'ثبت‌نام در پت‌باس' : 'ورود به حساب کاربری';
  const subheading = {
    password: 'با شماره موبایل یا ایمیل و رمز عبور وارد شوید.',
    sms: smsStep === 'phone' ? 'شماره موبایل خود را وارد کنید تا کد ورود برایتان پیامک شود.' : `کد ۵ رقمی ارسال‌شده به ${phone} را وارد کنید.`,
    register: 'با چند اطلاعات ساده حساب بسازید و سفارش‌هایتان را پیگیری کنید.',
    profile: 'برای ارسال سفارش، نام و نام خانوادگی خود را وارد کنید.',
  }[mode];

  const tabs = MODES.filter((t) => t.id !== 'sms' || smsEnabled);

  return (
    <div className="mx-auto max-w-md space-y-5 rounded-3xl border border-border bg-surface-card p-6 sm:p-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-black">{heading}</h1>
        <p className="text-sm leading-7 text-muted-foreground">{subheading}</p>
      </div>

      {mode !== 'profile' && (
        <div role="tablist" aria-label="روش ورود" className="grid gap-1 rounded-xl border border-border bg-surface p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`login-tab-${t.id}`}
              aria-selected={mode === t.id}
              aria-controls="login-panel"
              onClick={() => switchMode(t.id)}
              className={`min-h-10 rounded-lg px-2 text-xs font-bold transition-colors sm:text-sm ${
                mode === t.id ? 'bg-primary text-charcoal-950' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <div id="login-panel" role={mode === 'profile' ? undefined : 'tabpanel'} aria-labelledby={mode === 'profile' ? undefined : `login-tab-${mode}`}>
        {mode === 'password' && (
          <form method="post" onSubmit={submit(loginWithPasswordAction)} className="space-y-4">
            <Field label="شماره موبایل یا ایمیل" required>
              <Input name="identifier" autoComplete="username" dir="ltr" className="text-start" placeholder="09121234567 یا name@example.com" maxLength={120} required autoFocus />
            </Field>
            <PasswordField label="رمز عبور" name="password" autoComplete="current-password" />
            <Button type="submit" variant="gold" size="lg" block loading={pending} loadingText="در حال ورود…" disabled={notReady}>
              ورود
            </Button>
            <p className="text-center text-xs leading-6 text-muted-foreground">
              رمز عبور را فراموش کرده‌اید؟{' '}
              {smsEnabled ? (
                <button type="button" onClick={() => switchMode('sms')} className="font-bold text-primary hover:underline">
                  با کد پیامکی وارد شوید
                </button>
              ) : supportPhone ? (
                <a href={supportPhone} className="font-bold text-primary hover:underline">
                  با کلینیک تماس بگیرید
                </a>
              ) : (
                'با کلینیک تماس بگیرید.'
              )}
              {smsEnabled && ' و از «اطلاعات حساب» رمز جدید بسازید.'}
            </p>
          </form>
        )}

        {mode === 'register' && (
          <form method="post" noValidate onSubmit={submit(registerWithPasswordAction)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="نام" required>
                <Input name="firstName" autoComplete="given-name" maxLength={60} required autoFocus />
              </Field>
              <Field label="نام خانوادگی" required>
                <Input name="lastName" autoComplete="family-name" maxLength={60} required />
              </Field>
            </div>
            <Field label="شماره موبایل" hint="برای هماهنگی ارسال سفارش با شما تماس گرفته می‌شود." required>
              <Input name="phone" inputMode="tel" autoComplete="username" dir="ltr" className="text-start" placeholder="09121234567" maxLength={16} required />
            </Field>
            <Field label="ایمیل" hint="برای ورود با ایمیل. اختیاری است." optional>
              <Input name="email" type="email" inputMode="email" autoComplete="email" dir="ltr" className="text-start" placeholder="name@example.com" maxLength={120} />
            </Field>
            <PasswordField label="رمز عبور" name="password" autoComplete="new-password" hint={PASSWORD_HINT} />
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-7">
              <input type="checkbox" name="marketingSmsConsent" data-testid="register-sms-consent" className="mt-1.5 size-4 shrink-0 accent-[var(--color-primary,#c9a24a)]" />
              <span>
                مایلم پیشنهادهای ویژه و یادآوری‌های حیوان خانگی‌ام را با پیامک دریافت کنم. <span className="text-xs text-muted-foreground">(اختیاری؛ هر زمان قابل لغو است)</span>
              </span>
            </label>
            <Button type="submit" variant="gold" size="lg" block loading={pending} loadingText="در حال ساخت حساب…" disabled={notReady}>
              ثبت‌نام و ورود
            </Button>
          </form>
        )}

        {mode === 'sms' && smsStep === 'phone' && (
          <form method="post" onSubmit={(e) => (e.preventDefault(), sendCode())} className="space-y-4">
            <Field label="شماره موبایل" required>
              <Input
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                className="text-start"
                placeholder="09121234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={16}
                required
                autoFocus
              />
            </Field>
            <Button type="submit" variant="gold" size="lg" block loading={pending} loadingText="در حال ارسال…" disabled={notReady || cooldown > 0}>
              {cooldown > 0 ? `دریافت دوباره کد تا ${cooldown.toLocaleString('fa-IR')} ثانیه` : 'دریافت کد ورود'}
            </Button>
          </form>
        )}

        {mode === 'sms' && smsStep === 'code' && (
          <form method="post" onSubmit={(e) => (e.preventDefault(), verifyCode())} className="space-y-4">
            <Field label="کد ورود" hideLabel>
              <Input
                className="text-center text-xl font-bold tracking-[0.6em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={5}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d۰-۹]/g, '').slice(0, 5);
                  setCode(v);
                  if (v.length === 5) verifyCode(v);
                }}
                autoFocus
              />
            </Field>
            <Button type="submit" variant="gold" size="lg" block loading={pending} loadingText="در حال بررسی…" disabled={notReady || code.length !== 5}>
              ورود
            </Button>
            <div className="flex justify-between text-xs text-muted-foreground">
              <button type="button" onClick={() => (setSmsStep('phone'), setCode(''), setError(null))} className="hover:text-primary">
                ویرایش شماره
              </button>
              <button type="button" onClick={sendCode} disabled={cooldown > 0 || pending} className="hover:text-primary disabled:opacity-50">
                {cooldown > 0 ? `ارسال مجدد تا ${cooldown.toLocaleString('fa-IR')} ثانیه` : 'ارسال مجدد کد'}
              </button>
            </div>
          </form>
        )}

        {mode === 'profile' && (
          <form method="post" noValidate onSubmit={submitProfile(start, setError, go, next)} className="space-y-4">
            <Field label="نام" required>
              <Input name="firstName" autoComplete="given-name" maxLength={60} required autoFocus />
            </Field>
            <Field label="نام خانوادگی" required>
              <Input name="lastName" autoComplete="family-name" maxLength={60} required />
            </Field>
            <Field label="ایمیل" optional>
              <Input name="email" type="email" dir="ltr" className="text-start" autoComplete="email" />
            </Field>
            <Button type="submit" variant="gold" size="lg" block loading={pending} loadingText="در حال ذخیره…" disabled={notReady}>
              ذخیره و ادامه
            </Button>
          </form>
        )}
      </div>

      <p className="text-center text-[11px] leading-6 text-muted-foreground">
        شماره موبایل شما فقط برای ورود، پیگیری سفارش و هماهنگی ارسال استفاده می‌شود. با ثبت‌نام،{' '}
        <Link href="/terms" className="text-primary underline underline-offset-4">
          قوانین و مقررات
        </Link>{' '}
        و{' '}
        <Link href="/privacy" className="text-primary underline underline-offset-4">
          حریم خصوصی
        </Link>{' '}
        را می‌پذیرید.
      </p>
    </div>
  );
}

function submitProfile(
  start: React.TransitionStartFunction,
  setError: (e: string | null) => void,
  go: (path: string) => void,
  next: string
) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('next', next);
    start(async () => {
      setError(null);
      const res = await updateProfileAction(fd);
      if (res.error) return setError(res.error);
      go(res.redirectTo ?? '/account');
    });
  };
}
