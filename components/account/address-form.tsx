'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { saveAddressAction } from '@/app/actions/addresses';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { IRAN_PROVINCES, normalizeMobile, normalizePostalCode } from '@/lib/text/iran';

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

type FieldName = 'city' | 'addressLine' | 'postalCode' | 'recipientName' | 'recipientPhone';
const CHECKED: FieldName[] = ['city', 'addressLine', 'postalCode', 'recipientName', 'recipientPhone'];

/** Same rules as saveAddressAction, so most mistakes are caught before the round trip. */
function check(name: FieldName, value: string, province: string): string | null {
  const v = value.trim();
  switch (name) {
    case 'city':
      if (v.length < 2) return 'نام شهر را وارد کنید.';
      if (v === 'تهران' && province !== 'تهران') return 'شهر با استان انتخاب‌شده هم‌خوانی ندارد.';
      return null;
    case 'addressLine':
      return v.length < 10 ? 'نشانی را کامل‌تر بنویسید (خیابان، کوچه، نشانه).' : null;
    case 'postalCode':
      return normalizePostalCode(v) ? null : 'کد پستی باید ۱۰ رقم و معتبر باشد.';
    case 'recipientName':
      return v.length < 3 ? 'نام و نام خانوادگی تحویل‌گیرنده را وارد کنید.' : null;
    case 'recipientPhone':
      return normalizeMobile(v) ? null : 'شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۱۲۳۴۵۶۷';
  }
}

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
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const [province, setProvince] = useState(initial?.province ?? 'تهران');
  const [city, setCity] = useState(initial?.city ?? 'تهران');
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [serverError, setServerError] = useState<{ text: string; needsLogin?: boolean } | null>(null);
  const [pending, start] = useTransition();

  // A server error can be below the fold on a phone: bring it into view and announce it.
  useEffect(() => {
    if (!serverError) return;
    alertRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    alertRef.current?.focus({ preventScroll: true });
  }, [serverError]);

  const setFieldError = (name: FieldName, message: string | null) =>
    setErrors((prev) => {
      if ((prev[name] ?? null) === message) return prev;
      const next = { ...prev };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });

  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const name = e.target.name as FieldName;
    // Do not nag about a field the customer has not filled yet.
    if (CHECKED.includes(name) && e.target.value.trim()) setFieldError(name, check(name, e.target.value, province));
  };

  const onProvinceChange = (next: string) => {
    setProvince(next);
    // «تهران» is only the default for Tehran province; never carry it to another one.
    if (next !== 'تهران' && city.trim() === 'تهران') setCity('');
    if (next === 'تهران' && !city.trim()) setCity('تهران');
    setFieldError('city', null);
  };

  return (
    <form
      ref={formRef}
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        const found: Partial<Record<FieldName, string>> = {};
        for (const name of CHECKED) {
          const message = check(name, fd.get(name)?.toString() ?? '', province);
          if (message) found[name] = message;
        }
        setErrors(found);
        setServerError(null);
        const firstBad = CHECKED.find((n) => found[n]);
        if (firstBad) {
          formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
          return;
        }
        start(async () => {
          try {
            const res = await saveAddressAction(fd);
            if (res.error) setServerError({ text: res.error, needsLogin: res.needsLogin });
            else onSaved?.(res.addressId!);
          } catch {
            setServerError({ text: 'ذخیره نشانی انجام نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.' });
          }
        });
      }}
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
        <Field label="استان" required>
          <Select name="province" value={province} onChange={(e) => onProvinceChange(e.target.value)} autoComplete="address-level1" required>
            {IRAN_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="شهر" required error={errors.city}>
          <Input
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onBlur={onBlur}
            placeholder="نام شهر"
            autoComplete="address-level2"
            maxLength={60}
            required
          />
        </Field>
        <Field label="نشانی دقیق" required error={errors.addressLine} hint="خیابان، کوچه و یک نشانه نزدیک را بنویسید." className="sm:col-span-2">
          <Textarea
            name="addressLine"
            defaultValue={initial?.addressLine}
            onBlur={onBlur}
            rows={2}
            className="min-h-[4.5rem]"
            placeholder="مثال: خیابان شریعتی، بالاتر از قیطریه، کوچه ..."
            autoComplete="street-address"
            maxLength={300}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="پلاک" optional>
            <Input name="plaque" defaultValue={initial?.plaque ?? ''} maxLength={10} autoComplete="off" />
          </Field>
          <Field label="واحد" optional>
            <Input name="unit" defaultValue={initial?.unit ?? ''} maxLength={10} autoComplete="off" />
          </Field>
        </div>
        <Field label="کد پستی" required error={errors.postalCode} hint="ده رقم، بدون خط تیره">
          <Input
            name="postalCode"
            defaultValue={initial?.postalCode}
            onBlur={onBlur}
            inputMode="numeric"
            dir="ltr"
            className="ltr-nums text-start"
            maxLength={10}
            pattern="[0-9۰-۹]{10}"
            autoComplete="postal-code"
            required
          />
        </Field>
        <Field label="نام و نام خانوادگی تحویل‌گیرنده" required error={errors.recipientName}>
          <Input
            name="recipientName"
            defaultValue={initial?.recipientName ?? defaultRecipient?.name}
            onBlur={onBlur}
            autoComplete="name"
            maxLength={80}
            required
          />
        </Field>
        <Field label="موبایل تحویل‌گیرنده" required error={errors.recipientPhone} hint="پیک یا مأمور پست با این شماره تماس می‌گیرد.">
          <Input
            name="recipientPhone"
            type="tel"
            defaultValue={initial?.recipientPhone ?? defaultRecipient?.phone}
            onBlur={onBlur}
            inputMode="tel"
            dir="ltr"
            className="ltr-nums text-start"
            maxLength={16}
            placeholder="09121234567"
            autoComplete="tel"
            required
          />
        </Field>
        <Field label="عنوان نشانی" optional className="sm:col-span-2">
          <Input name="title" defaultValue={initial?.title ?? ''} placeholder="خانه، محل کار…" maxLength={40} autoComplete="off" />
        </Field>
      </div>

      {serverError && (
        <Alert
          ref={alertRef}
          tone="error"
          tabIndex={-1}
          action={
            serverError.needsLogin ? (
              <Link href={`/account/login?next=${encodeURIComponent(pathname)}`} className="btn btn-outline btn-sm">
                ورود دوباره
              </Link>
            ) : undefined
          }
        >
          {serverError.text}
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" variant="gold" loading={pending} className="w-full sm:w-auto sm:min-w-36">
          {pending ? 'در حال ذخیره…' : 'ذخیره نشانی'}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending} className="w-full sm:w-auto">
            انصراف
          </Button>
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
