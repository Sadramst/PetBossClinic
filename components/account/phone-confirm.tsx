'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPhoneAction, requestPhoneConfirmationAction } from '@/app/actions/customer-auth';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHydrated } from '@/components/account/use-hydrated';

/** Confirms the customer's mobile number with an SMS code (only rendered when SMS is configured). */
export function PhoneConfirm({ phone }: { phone: string }) {
  const router = useRouter();
  const ready = useHydrated();
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = () =>
    start(async () => {
      setError(null);
      try {
        const res = await requestPhoneConfirmationAction();
        if (res.error) {
          if (res.retryAfter) setCooldown(res.retryAfter);
          setError(res.error);
          if (res.needsLogin) window.location.assign('/account/login?next=/account/profile');
          return;
        }
        setStep('code');
        setCooldown(60);
      } catch {
        setError('خطا در ارتباط با سرور. دوباره تلاش کنید.');
      }
    });

  const confirm = () =>
    start(async () => {
      setError(null);
      try {
        const res = await confirmPhoneAction(code);
        if (res.error) return setError(res.error);
        router.refresh();
      } catch {
        setError('خطا در ارتباط با سرور. دوباره تلاش کنید.');
      }
    });

  return (
    <div className="space-y-3" data-testid="phone-confirm">
      {error && <Alert tone="error">{error}</Alert>}
      {step === 'idle' ? (
        <Button type="button" variant="outline" size="sm" onClick={send} loading={pending} disabled={!ready || cooldown > 0}>
          {cooldown > 0 ? `تلاش دوباره تا ${cooldown.toLocaleString('fa-IR')} ثانیه` : 'ارسال کد تأیید شماره'}
        </Button>
      ) : (
        <form method="post" onSubmit={(e) => (e.preventDefault(), confirm())} className="flex max-w-sm flex-wrap items-center gap-2">
          <Input
            aria-label="کد تأیید"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={5}
            className="w-36 text-center font-bold tracking-[0.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d۰-۹]/g, '').slice(0, 5))}
            autoFocus
          />
          <Button type="submit" variant="gold" size="sm" loading={pending} disabled={!ready || code.length !== 5}>
            تأیید شماره
          </Button>
          <button type="button" onClick={send} disabled={cooldown > 0 || pending} className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50">
            {cooldown > 0 ? `ارسال مجدد تا ${cooldown.toLocaleString('fa-IR')} ثانیه` : 'ارسال مجدد کد'}
          </button>
        </form>
      )}
    </div>
  );
}
