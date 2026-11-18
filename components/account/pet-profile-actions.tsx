'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import { addPetRecordAction, deletePetAction, deletePetRecordAction, setPetPhotoAction } from '@/app/actions/pets';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toaster';
import { useHydrated } from '@/components/account/use-hydrated';
import { PetForm, type PetFormValues } from '@/components/account/pet-form';
import { RECORD_KIND_LABEL } from '@/lib/club/pet-math';

const field = 'w-full h-11 rounded-xl border border-border bg-input px-3 text-sm focus:border-primary focus:outline-none';

/** Resizes in the browser so the upload stays under the server's 200 KB cap. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  let side = 480;
  for (let attempt = 0; attempt < 5; attempt++) {
    const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    for (const q of [0.85, 0.7, 0.55]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length * 0.75 < 190 * 1024) return url;
    }
    side = Math.round(side * 0.7);
  }
  throw new Error('big');
}

export function PetPhotoControl({ petId, hasPhoto }: { petId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; bonus?: number }>, okMsg: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? 'انجام نشد.');
      toast.success(okMsg, res.bonus ? `${res.bonus.toLocaleString('fa-IR')} امتیاز باشگاه هدیه گرفتید.` : undefined);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="انتخاب عکس حیوان خانگی"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return void toast.error('فقط عکس JPG، PNG یا WebP پذیرفته می‌شود.');
          run(async () => {
            try {
              return await setPetPhotoAction(petId, await shrink(f));
            } catch {
              return { ok: false, error: 'این عکس پردازش نشد. عکس دیگری را امتحان کنید.' };
            }
          }, 'عکس ذخیره شد');
        }}
      />
      <button type="button" disabled={pending || !hydrated} onClick={() => input.current?.click()} className="h-9 rounded-xl border border-border px-3 text-xs hover:border-primary disabled:opacity-60">
        {hasPhoto ? 'تغییر عکس' : 'افزودن عکس'}
      </button>
      {hasPhoto && (
        <button type="button" disabled={pending} onClick={() => run(() => setPetPhotoAction(petId, null), 'عکس حذف شد')} className="h-9 rounded-xl border border-border px-3 text-xs text-red-300 hover:border-red-400 disabled:opacity-60">
          حذف عکس
        </button>
      )}
    </div>
  );
}

export function PetEditPanel({ petId, initial }: { petId: string; initial: PetFormValues }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="h-9 rounded-xl border border-border px-4 text-xs hover:border-primary">
        {open ? 'بستن ویرایش' : 'ویرایش پروفایل'}
      </button>
      {open && (
        <div className="rounded-2xl border border-primary/40 bg-surface-card p-4 sm:p-5">
          <PetForm petId={petId} initial={initial} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export function PetDeleteButton({ petId, name }: { petId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-xl border border-border px-4 text-xs text-red-300 hover:border-red-400">
        حذف حیوان خانگی
      </button>
      <ConfirmDialog
        open={open}
        title={`حذف ${name}؟`}
        description="پروفایل از حساب شما حذف می‌شود. سوابق خدمات کلینیک در پرونده باقی می‌ماند."
        confirmLabel="بله، حذف شود"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await deletePetAction(petId);
            if (!res.ok) { toast.error(res.error ?? 'حذف انجام نشد.'); return setOpen(false); }
            toast.success('حذف شد');
            router.push('/account/pets');
          })
        }
      />
    </>
  );
}

export function RecordDeleteButton({ recordId, petId }: { recordId: string; petId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" aria-label="حذف این سابقه" onClick={() => setOpen(true)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-surface-hover">
        حذف
      </button>
      <ConfirmDialog
        open={open}
        title="حذف این سابقه؟"
        confirmLabel="حذف"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await deletePetRecordAction(recordId, petId);
            setOpen(false);
            if (!res.ok) return void toast.error(res.error ?? 'حذف انجام نشد.');
            router.refresh();
          })
        }
      />
    </>
  );
}

const KINDS = Object.entries(RECORD_KIND_LABEL);
const REPEATING = new Set(['VACCINE', 'DEWORMING', 'CHECKUP', 'DENTAL', 'GROOMING']);

export function PetRecordForm({ petId }: { petId: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [kind, setKind] = useState('VACCINE');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form
      noValidate
      className="space-y-3 rounded-2xl border border-border bg-surface-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const s = (k: string) => String(fd.get(k) ?? '').trim();
        start(async () => {
          setError(null);
          const res = await addPetRecordAction(petId, {
            kind: kind as never, title: s('title'), doneAt: s('doneAt'),
            nextDueAt: s('nextDueAt') || null, valueNumber: kind === 'WEIGHT' ? s('valueNumber') || null : null, notes: s('notes') || null,
          } as never);
          if (!res.ok) return setError(res.error ?? 'ذخیره انجام نشد.');
          form.reset();
          setKind('VACCINE');
          toast.success('سابقه ثبت شد');
          router.refresh();
        });
      }}
    >
      <h3 className="font-bold">ثبت سابقه جدید</h3>
      {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">نوع
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
            {KINDS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>
        <label className="block space-y-1 text-sm">عنوان
          <input name="title" maxLength={80} required className={field} placeholder={kind === 'VACCINE' ? 'مثلاً واکسن سه‌گانه' : kind === 'WEIGHT' ? 'وزن‌کشی' : ''} />
        </label>
        <label className="block space-y-1 text-sm">تاریخ انجام
          <input name="doneAt" type="date" dir="ltr" max={today} defaultValue={today} required className={`${field} text-start`} />
        </label>
        {REPEATING.has(kind) && (
          <label className="block space-y-1 text-sm">نوبت بعدی (برای یادآوری)
            <input name="nextDueAt" type="date" dir="ltr" className={`${field} text-start`} />
          </label>
        )}
        {kind === 'WEIGHT' && (
          <label className="block space-y-1 text-sm">وزن (کیلوگرم)
            <input name="valueNumber" inputMode="decimal" dir="ltr" required className={`${field} text-start`} />
          </label>
        )}
        <label className="block space-y-1 text-sm sm:col-span-2">توضیحات
          <input name="notes" maxLength={500} className={field} />
        </label>
      </div>
      <button data-testid="pet-record-add" disabled={pending || !hydrated} className="h-11 rounded-xl bg-gradient-gold px-6 text-sm font-bold text-charcoal-950 disabled:opacity-60">
        {pending ? 'در حال ثبت…' : 'ثبت سابقه'}
      </button>
    </form>
  );
}
