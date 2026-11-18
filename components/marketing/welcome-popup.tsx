'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { captureContactAction } from '@/app/actions/marketing';
import { getMarketingViewerAction } from '@/app/actions/marketing-storefront';
import { CopyButton } from '@/components/marketing/copy-button';
import { COUPON_KEY, POPUP_KEY, isSnoozed, parseLead, setSnooze, validateLead, writeStore } from '@/components/marketing/storage';

export interface PopupConfig {
  enabled: boolean;
  title: string;
  text: string;
  delaySeconds: number;
}

const BLOCKED = ['/admin', '/checkout', '/cart', '/account/login'];

export function WelcomePopup({ config }: { config: PopupConfig }) {
  const pathname = usePathname();
  const blocked = BLOCKED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ code: string; message: string; alreadyHad: boolean } | null>(null);
  const shownRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const close = useCallback((remember = true) => {
    setOpen(false);
    if (remember) setSnooze(POPUP_KEY, 7);
    lastFocus.current?.focus?.();
  }, []);

  // Decide when to show: after the delay, or on exit intent (desktop). Once per page load.
  useEffect(() => {
    if (!config.enabled || blocked || shownRef.current) return;
    if (isSnoozed(POPUP_KEY)) return;
    let alive = true;
    const show = async () => {
      if (!alive || shownRef.current) return;
      const viewer = await getMarketingViewerAction().catch(() => ({ signedIn: false, hasWelcomeCode: false }));
      if (!alive || shownRef.current || viewer.hasWelcomeCode) return;
      shownRef.current = true;
      lastFocus.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    const timer = setTimeout(show, Math.max(0, config.delaySeconds) * 1000);
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && e.relatedTarget === null) show();
    };
    const fine = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
    if (fine) document.addEventListener('mouseout', onLeave);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener('mouseout', onLeave);
    };
  }, [config.enabled, config.delaySeconds, blocked]);

  // Closes when navigating to a page where the popup must not appear.
  useEffect(() => {
    if (blocked && open) setOpen(false);
  }, [blocked, open]);

  // Focus trap, Escape and scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    const focusables = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled])') ?? []);
    (root?.querySelector<HTMLElement>('input') ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, result]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const problem = validateLead(value);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await captureContactAction({ ...parseLead(value), source: 'popup' });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ code: res.code, message: res.message, alreadyHad: res.alreadyHad });
      setSnooze(POPUP_KEY, 365);
      if (res.code) writeStore(COUPON_KEY, res.code);
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => close()} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-popup-title"
        aria-describedby="welcome-popup-text"
        data-testid="welcome-popup"
        className="surface-card relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl"
      >
        <button
          type="button"
          data-testid="welcome-popup-close"
          onClick={() => close()}
          aria-label="بستن"
          className="absolute end-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-surface-hover"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        {result ? (
          <div className="space-y-4 pt-2 text-center">
            <h2 id="welcome-popup-title" className="text-xl font-black">
              {result.code ? (result.alreadyHad ? 'کد تخفیف شما همین است' : 'کد تخفیف شما آماده است') : 'ثبت شد'}
            </h2>
            <div id="welcome-popup-text" className="space-y-4">
              {result.code ? (
                <>
                  <p
                    data-testid="welcome-code"
                    dir="ltr"
                    className="rounded-2xl border border-dashed border-primary bg-primary/10 px-4 py-4 text-2xl font-black tracking-widest text-primary [overflow-wrap:anywhere]"
                  >
                    {result.code}
                  </p>
                  <CopyButton text={result.code} />
                  <p className="text-xs leading-6 text-muted-foreground">کد در حساب شما هم ذخیره شد؛ پس از ورود در بخش «کدهای تخفیف من» می‌بینید.</p>
                  <p className="text-xs leading-6 text-muted-foreground">{result.message}</p>
                </>
              ) : (
                <p className="text-sm leading-7 text-muted-foreground">{result.message || 'اطلاعات شما ثبت شد؛ از همراهی‌تان سپاسگزاریم.'}</p>
              )}
            </div>
            <Link href="/shop" onClick={() => close(false)} className="btn btn-gold btn-lg btn-block">
              شروع خرید
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4 pt-2">
            <h2 id="welcome-popup-title" className="pe-10 text-xl font-black leading-9">
              {config.title}
            </h2>
            <p id="welcome-popup-text" className="text-sm leading-7 text-muted-foreground">
              {config.text}
            </p>
            <div className="space-y-2">
              <label htmlFor="welcome-popup-input" className="text-xs font-bold">
                شماره موبایل یا ایمیل
              </label>
              <input
                id="welcome-popup-input"
                data-testid="welcome-popup-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="username"
                inputMode="email"
                dir="ltr"
                placeholder="09123456789"
                aria-invalid={!!error}
                aria-describedby={error ? 'welcome-popup-error' : undefined}
                className="h-12 w-full rounded-xl border border-border bg-input px-3 text-start text-sm"
              />
              {error && (
                <p id="welcome-popup-error" role="alert" className="text-xs leading-6 text-red-400">
                  {error}
                </p>
              )}
            </div>
            <button type="submit" data-testid="welcome-popup-submit" disabled={pending} className="btn btn-gold btn-lg btn-block">
              {pending ? 'در حال ساخت کد…' : 'دریافت کد تخفیف'}
            </button>
            <p className="text-[11px] leading-6 text-muted-foreground">
              با ثبت اطلاعات، موافقت می‌کنید پیشنهادهای پت‌باس را دریافت کنید. هر زمان می‌توانید لغو کنید.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
