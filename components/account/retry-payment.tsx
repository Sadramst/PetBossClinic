'use client';

import { useState, useTransition } from 'react';
import { retryPaymentAction } from '@/app/actions/checkout';

export function RetryPayment({ orderNumber }: { orderNumber: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await retryPaymentAction(orderNumber);
            if (res.error) setError(res.error);
            else if (res.redirectTo) window.location.assign(res.redirectTo);
          })
        }
        className="h-11 px-6 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-sm disabled:opacity-60"
      >
        {pending ? 'در حال اتصال به درگاه…' : 'پرداخت آنلاین سفارش'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
