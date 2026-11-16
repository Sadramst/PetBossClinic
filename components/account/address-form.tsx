'use client';

import { useState, useTransition } from 'react';
import { saveAddressAction } from '@/app/actions/addresses';
import { IRAN_PROVINCES } from '@/lib/text/iran';

export interface AddressData {
  id: string;
  title: string | null;
  recipientName: string;
  recipientPhone: string;
  province: string;
  city: string;
  addressLine: string;
  plaque: string | null;
  unit: string | null;
  postalCode: string;
  isDefault: boolean;
}

const field = 'w-full h-11 rounded-xl border border-border bg-input px-3 text-sm focus:border-primary focus:outline-none';

export function AddressForm({
  initial,
  defaultRecipient,
  onSaved,
  onCancel,
}: {
  initial?: AddressData | null;
  defaultRecipient?: { name: string; phone: string };
  onSaved?: (addressId: string) => void;
  onCancel?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await saveAddressAction(fd);
          if (res.error) setError(res.error);
          else onSaved?.(res.addressId!);
        });
      }}
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-4 py-2.5">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>استان</span>
          <select name="province" defaultValue={initial?.province ?? 'تهران'} className={field} required>
            {IRAN_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>شهر</span>
          <input name="city" defaultValue={initial?.city ?? 'تهران'} className={field} required />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>نشانی دقیق (خیابان، کوچه، نشانه)</span>
          <textarea
            name="addressLine"
            defaultValue={initial?.addressLine}
            rows={2}
            className={`${field} h-auto py-2.5 leading-7`}
            placeholder="مثال: خیابان شریعتی، بالاتر از قیطریه، کوچه ..."
            required
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span>پلاک</span>
            <input name="plaque" defaultValue={initial?.plaque ?? ''} className={field} inputMode="numeric" />
          </label>
          <label className="space-y-1 text-sm">
            <span>واحد</span>
            <input name="unit" defaultValue={initial?.unit ?? ''} className={field} inputMode="numeric" />
          </label>
        </div>
        <label className="space-y-1 text-sm">
          <span>کد پستی ۱۰ رقمی</span>
          <input name="postalCode" defaultValue={initial?.postalCode} className={field} inputMode="numeric" dir="ltr" maxLength={12} required />
        </label>
        <label className="space-y-1 text-sm">
          <span>نام و نام خانوادگی تحویل‌گیرنده</span>
          <input name="recipientName" defaultValue={initial?.recipientName ?? defaultRecipient?.name} className={field} required />
        </label>
        <label className="space-y-1 text-sm">
          <span>موبایل تحویل‌گیرنده</span>
          <input
            name="recipientPhone"
            defaultValue={initial?.recipientPhone ?? defaultRecipient?.phone}
            className={field}
            inputMode="tel"
            dir="ltr"
            required
          />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>عنوان نشانی (اختیاری)</span>
          <input name="title" defaultValue={initial?.title ?? ''} className={field} placeholder="خانه، محل کار…" />
        </label>
      </div>
      <div className="flex gap-2">
        <button disabled={pending} className="h-11 px-6 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-sm disabled:opacity-60">
          {pending ? 'در حال ذخیره…' : 'ذخیره نشانی'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-11 px-5 rounded-xl border border-border text-sm">
            انصراف
          </button>
        )}
      </div>
    </form>
  );
}

export function formatAddress(a: Pick<AddressData, 'province' | 'city' | 'addressLine' | 'plaque' | 'unit'>): string {
  return [a.province !== a.city ? a.province : null, a.city, a.addressLine, a.plaque && `پلاک ${a.plaque}`, a.unit && `واحد ${a.unit}`]
    .filter(Boolean)
    .join('، ');
}
