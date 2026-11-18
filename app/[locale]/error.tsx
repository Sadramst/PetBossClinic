'use client';

import { useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { EmptyState } from '@/components/ui/empty-state';

/** Clinic landline: the verified default in lib/clinic/nap.ts (this boundary cannot query the database). */
const CLINIC_TEL = 'tel:+982126429715';
const CLINIC_TEL_DISPLAY = '۰۲۱-۲۶۴۲۹۷۱۵';

/**
 * Farsi error boundary for every page under the locale layout (header and
 * footer stay visible). Replaces Next's English "Application error" screen.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-narrow">
      <EmptyState
        as="h1"
        role="alert"
        icon={
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 8v5m0 3.5v.5M10.3 3.9 2.4 17.5a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        }
        title="مشکلی پیش آمد"
        description="در بارگذاری این صفحه خطایی رخ داد. لطفاً دوباره تلاش کنید؛ اگر مشکل ادامه داشت، با کلینیک تماس بگیرید تا راهنمایی‌تان کنیم."
        action={
          <button type="button" onClick={reset} className="btn btn-gold">
            تلاش دوباره
          </button>
        }
        secondaryAction={
          <Link href="/" className="btn btn-outline">
            بازگشت به خانه
          </Link>
        }
      >
        <p className="mt-5 text-sm text-muted-foreground">
          <Link href="/shop" className="font-bold text-primary hover:underline">
            رفتن به پت‌شاپ
          </Link>
          <span className="mx-2" aria-hidden>
            ·
          </span>
          تماس با کلینیک:{' '}
          <a href={CLINIC_TEL} className="ltr-nums font-bold text-primary hover:underline">
            {CLINIC_TEL_DISPLAY}
          </a>
        </p>
        {error.digest && (
          <p className="mt-3 text-[11px] text-muted-foreground/70">
            کد پیگیری: <span className="ltr-nums">{error.digest}</span>
          </p>
        )}
      </EmptyState>
    </div>
  );
}
