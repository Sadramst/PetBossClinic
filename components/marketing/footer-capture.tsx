'use client';

import { useState } from 'react';
import { captureContactAction } from '@/app/actions/marketing';
import { CopyButton } from '@/components/marketing/copy-button';
import { COUPON_KEY, parseLead, validateLead, writeStore } from '@/components/marketing/storage';

export function FooterCapture({ offerLabel }: { offerLabel?: string }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ code: string; message: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const problem = validateLead(value);
    if (problem) return setError(problem);
    setError(null);
    setPending(true);
    try {
      const res = await captureContactAction({ ...parseLead(value), source: 'footer' });
      if (!res.ok) return setError(res.error);
      if (res.code) writeStore(COUPON_KEY, res.code);
      setDone({ code: res.code, message: res.message });
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="border-b border-border">
      <div className="container mx-auto grid max-w-7xl gap-4 px-4 py-6 md:grid-cols-[1fr_minmax(0,28rem)] md:items-center">
        <div className="space-y-1">
          <h2 className="font-extrabold text-foreground">{offerLabel ? `${offerLabel} برای اولین خرید` : 'کد تخفیف اولین خرید'}</h2>
          <p className="text-sm leading-7">شماره موبایل یا ایمیل‌تان را بگذارید تا کد تخفیف شخصی‌تان همین‌جا ساخته شود.</p>
        </div>
        {done ? (
          <div className="space-y-2" role="status">
            {done.code ? (
              <div className="flex flex-wrap items-center gap-3">
                <span data-testid="welcome-code" dir="ltr" className="rounded-xl border border-dashed border-primary bg-primary/10 px-4 py-2 font-black tracking-widest text-primary">
                  {done.code}
                </span>
                <CopyButton text={done.code} />
              </div>
            ) : null}
            <p className="text-xs leading-6">{done.message}</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-2">
            <div className="flex gap-2">
              <label htmlFor="footer-capture-input" className="sr-only">
                شماره موبایل یا ایمیل
              </label>
              <input
                id="footer-capture-input"
                data-testid="footer-capture-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                dir="ltr"
                inputMode="email"
                autoComplete="off"
                placeholder="09123456789"
                aria-invalid={!!error}
                aria-describedby={error ? 'footer-capture-error' : undefined}
                className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-input px-3 text-start text-sm text-foreground"
              />
              <button type="submit" data-testid="footer-capture-submit" disabled={pending} className="btn btn-gold h-12 shrink-0">
                {pending ? '…' : 'دریافت کد'}
              </button>
            </div>
            {error && (
              <p id="footer-capture-error" role="alert" className="text-xs leading-6 text-red-400">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
