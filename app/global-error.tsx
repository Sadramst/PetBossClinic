'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary: shown only when the locale layout itself fails, so it
 * renders its own document and cannot rely on the stylesheet, fonts or
 * providers. Everything is styled inline in the brand colours.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const button = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    padding: '0 20px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    textDecoration: 'none',
    cursor: 'pointer',
  } as const;

  return (
    <html lang="fa-IR" dir="rtl">
      <head>
        <title>مشکلی پیش آمد | پت‌باس</title>
        <meta name="robots" content="noindex" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#181a20',
          color: '#f6f6f8',
          fontFamily: 'Vazirmatn, Tahoma, system-ui, sans-serif',
          lineHeight: 1.9,
          textAlign: 'center',
        }}
      >
        <main style={{ maxWidth: 420 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#c5a059' }}>پت‌باس</p>
          <h1 style={{ margin: '12px 0 0', fontSize: 24, fontWeight: 800 }}>مشکلی پیش آمد</h1>
          <p style={{ margin: '12px 0 0', fontSize: 14, color: '#9ba1ad' }}>
            سایت موقتاً با خطا روبه‌رو شده است. لطفاً چند لحظه دیگر دوباره تلاش کنید یا با کلینیک تماس بگیرید.
          </p>
          <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                ...button,
                border: 0,
                color: '#181a20',
                background: 'linear-gradient(135deg, #e3bf62 0%, #c5a059 55%, #b58d3c 100%)',
              }}
            >
              تلاش دوباره
            </button>
            {/* A full reload on purpose: client navigation is unavailable when the root layout has crashed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ ...button, border: '1px solid rgba(197,160,89,0.45)', color: '#c5a059' }}>
              بازگشت به خانه
            </a>
          </div>
          <p style={{ margin: '20px 0 0', fontSize: 14, color: '#9ba1ad' }}>
            تماس با کلینیک:{' '}
            <a href="tel:+982126429715" dir="ltr" style={{ color: '#c5a059', fontWeight: 700, textDecoration: 'none' }}>
              ۰۲۱-۲۶۴۲۹۷۱۵
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
