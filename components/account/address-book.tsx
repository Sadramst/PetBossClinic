'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import { deleteAddressAction, setDefaultAddressAction } from '@/app/actions/addresses';
import { AddressForm, formatAddress, type AddressData } from '@/components/account/address-form';

export function AddressBook({ addresses, recipient }: { addresses: AddressData[]; recipient: { name: string; phone: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AddressData | 'new' | null>(addresses.length === 0 ? 'new' : null);
  const [pending, start] = useTransition();
  const refresh = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {editing ? (
        <div className="rounded-2xl border border-border bg-surface-card p-5">
          <h2 className="font-bold mb-4">{editing === 'new' ? 'افزودن نشانی جدید' : 'ویرایش نشانی'}</h2>
          <AddressForm
            initial={editing === 'new' ? null : editing}
            defaultRecipient={recipient}
            onSaved={refresh}
            onCancel={addresses.length ? () => setEditing(null) : undefined}
          />
        </div>
      ) : (
        <button onClick={() => setEditing('new')} className="h-11 px-5 rounded-xl border border-primary text-primary font-bold text-sm">
          + افزودن نشانی جدید
        </button>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {addresses.map((a) => (
          <li key={a.id} className={`rounded-2xl border p-4 bg-surface-card ${a.isDefault ? 'border-primary' : 'border-border'}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-sm">{a.title || a.recipientName}</p>
              {a.isDefault && <span className="text-[11px] text-primary">پیش‌فرض</span>}
            </div>
            <p className="text-sm text-muted-foreground leading-7 mt-1">{formatAddress(a)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              کد پستی <span dir="ltr">{a.postalCode}</span> · {a.recipientName} · <span dir="ltr">{a.recipientPhone}</span>
            </p>
            <div className="flex gap-4 mt-3 text-xs">
              <button onClick={() => setEditing(a)} className="text-primary">ویرایش</button>
              {!a.isDefault && (
                <button disabled={pending} onClick={() => start(async () => (await setDefaultAddressAction(a.id), router.refresh()))}>
                  انتخاب به‌عنوان پیش‌فرض
                </button>
              )}
              <button
                disabled={pending}
                className="text-red-400 ms-auto"
                onClick={() => confirm('این نشانی حذف شود؟') && start(async () => (await deleteAddressAction(a.id), router.refresh()))}
              >
                حذف
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
