'use client'

import { useState } from 'react'
import { Link } from '@/i18n/routing'
import {
  adjustPointsAction,
  adminAddRecordAction,
  adminCreatePetAction,
  adminDeletePetAction,
  adminDeleteRecordAction,
  adminUpdatePetAction,
  addCustomerNoteAction,
  applyInsightAction,
  createPersonalCouponAction,
  deleteCustomerAction,
  deleteVisitAction,
  draftMessageAction,
  recordVisitAction,
  sendCartReminderAction,
  sendCustomerMessageAction,
  updateCustomerAction,
  updateVisitAction,
} from '@/app/actions/admin-club'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toaster'
import { POINTS_KIND_LABEL } from '@/lib/club/labels'
import { RECORD_KIND_LABEL, SEX_LABEL, SPECIES_LABEL } from '@/lib/club/pet-math'
import { ORDER_STATUS_LABEL } from '@/components/admin/order-status'
import { faNum, toman } from '@/components/admin/format'
import { Card, Empty, Stat, TableWrap, td, th, useAct } from '@/components/admin/club/kit'

interface PetView {
  id: string
  name: string
  species: string
  breed: string
  sex: string
  birthDate: string
  weightKg: number | null
  neutered: boolean | null
  foodBrand: string
  allergies: string
  medicalNotes: string
  isActive: boolean
  records: { id: string; kind: string; title: string; done: string; next: string | null; due: string; value: number | null; notes: string; source: string }[]
}
interface VisitView {
  id: string
  petId: string
  petName: string
  serviceId: string
  serviceName: string
  date: string
  dateIso: string
  amount: number
  doctor: string
  notes: string
  points: number
}

export interface C360Props {
  isAdmin: boolean
  senderNote: string | null
  customer: {
    id: string
    firstName: string
    lastName: string
    phone: string
    email: string
    city: string
    gender: string
    birthDate: string
    tags: string
    source: string
    notes: string
    tier: string
    tierLabel: string
    tierColor: string
    nextTier: string | null
    progressPercent: number
    points: number
    lifetime: number
    spent: number
    orders: number
    lastOrder: string | null
    consent: boolean
    consentAt: string | null
    joined: string
    createdByAdmin: boolean
    referralCode: string
    blocked: boolean
    pointValueToman: number
  }
  insights: { id: string; title: string; reason: string; type: 'coupon' | 'message' | 'task' }[]
  pets: PetView[]
  visits: VisitView[]
  services: { id: string; name: string }[]
  orders: { id: string; number: string; status: string; total: number; date: string }[]
  ledger: { id: string; kind: string; points: number; balance: number; note: string; date: string }[]
  coupons: { id: string; code: string; title: string; active: boolean; used: boolean; source: string; ends: string | null }[]
  notes: { id: string; body: string; by: string; date: string }[]
  cart: { items: { name: string; quantity: number; price: number }[]; subtotal: number; updated: string; reminded: string | null } | null
  messages: { id: string; kind: string; body: string; status: string; date: string; error: string }[]
}

const MSG_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
  QUEUED: { label: 'در صف', tone: 'warning' },
  SENDING: { label: 'در حال ارسال', tone: 'info' },
  SENT: { label: 'ارسال شد', tone: 'success' },
  FAILED: { label: 'ناموفق', tone: 'danger' },
  SKIPPED: { label: 'رد شد', tone: 'neutral' },
  CANCELLED: { label: 'لغو شد', tone: 'neutral' },
}

const v = (fd: FormData, k: string) => String(fd.get(k) ?? '')

export function Customer360(p: C360Props) {
  const c = p.customer
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone
  return (
    <div className="space-y-4" data-testid="customer-360">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border-gold bg-surface-card p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold">{name}</h1>
            <span className="rounded-full border px-2.5 py-0.5 text-xs font-bold" style={{ borderColor: c.tierColor, color: c.tierColor }} data-testid="c360-tier">
              {c.tierLabel}
            </span>
            {c.createdByAdmin && <Badge tone="info">ثبت توسط کلینیک</Badge>}
            {c.blocked && <Badge tone="danger">مسدود</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground" dir="ltr" style={{ textAlign: 'start' }}>
            {c.phone}
            {c.email ? ` · ${c.email}` : ''}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            عضویت از {c.joined}
            {c.city ? ` · ${c.city}` : ''}
          </p>
          <p className={`mt-2 text-xs font-bold ${c.consent ? 'text-emerald-400' : 'text-amber-400'}`}>
            {c.consent ? `رضایت پیامک تبلیغاتی ثبت است${c.consentAt ? ` (${c.consentAt})` : ''}` : 'رضایت پیامک تبلیغاتی ندارد؛ پیام تبلیغاتی برایش ارسال نمی‌شود.'}
          </p>
        </div>
        <div className="grid min-w-0 basis-full grid-cols-2 gap-2 sm:max-w-xl sm:flex-1 sm:basis-0 sm:grid-cols-4">
          <Stat label="امتیاز فعلی" value={faNum(c.points)} hint={`≈ ${toman(c.points * c.pointValueToman)}`} testId="c360-points" />
          <Stat label="سفارش‌ها" value={faNum(c.orders)} hint={c.lastOrder ? `آخرین: ${c.lastOrder}` : 'بدون سفارش'} />
          <Stat label="مجموع خرید" value={toman(c.spent)} />
          <Stat label="امتیاز کل" value={faNum(c.lifetime)} hint={c.nextTier ?? 'بالاترین سطح'} />
        </div>
      </header>

      <Tabs
        label="بخش‌های پروفایل مشتری"
        variant="pills"
        tabs={[
          { id: 'overview', label: 'نمای کلی', content: <Overview {...p} /> },
          { id: 'pets', label: 'حیوانات', count: p.pets.length, content: <Pets {...p} /> },
          { id: 'visits', label: 'خدمات', count: p.visits.length, content: <Visits {...p} /> },
          { id: 'orders', label: 'سفارش‌ها', count: p.orders.length, content: <Orders {...p} /> },
          { id: 'points', label: 'امتیاز', content: <Points {...p} /> },
          { id: 'coupons', label: 'کدهای تخفیف', count: p.coupons.length, content: <Coupons {...p} /> },
          { id: 'messages', label: 'پیام‌ها', count: p.messages.length, content: <Messages {...p} /> },
          { id: 'notes', label: 'یادداشت‌ها', count: p.notes.length, content: <Notes {...p} /> },
          { id: 'cart', label: 'سبد خرید', content: <Cart {...p} /> },
        ]}
      />
    </div>
  )
}

/* -------------------------------------------------------------- overview */

function Overview(p: C360Props) {
  const { run, pending } = useAct()
  const c = p.customer
  const [open, setOpen] = useState(false)
  const label = { coupon: 'ساخت کد و ارسال پیام', message: 'ارسال پیام', task: 'ثبت در یادداشت‌ها' } as const

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    run(
      () =>
        updateCustomerAction(c.id, {
          firstName: v(fd, 'firstName'),
          lastName: v(fd, 'lastName'),
          phone: v(fd, 'phone'),
          email: v(fd, 'email'),
          birthDate: v(fd, 'birthDate'),
          gender: (v(fd, 'gender') || null) as 'MALE' | 'FEMALE' | 'OTHER' | null,
          city: v(fd, 'city'),
          tags: v(fd, 'tags'),
          notes: v(fd, 'notes'),
          source: v(fd, 'source'),
          marketingSmsConsent: fd.get('consent') === 'on',
        }),
      { ok: 'پروفایل ذخیره شد', after: () => setOpen(false) }
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card title="پیشنهادهای هوشمند (فرصت‌های فروش و ارتباط)">
        {p.insights.length === 0 ? (
          <Empty>فعلاً پیشنهاد تازه‌ای نیست.</Empty>
        ) : (
          <ul className="space-y-3" data-testid="insights">
            {p.insights.map((i) => (
              <li key={i.id} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-sm font-bold">{i.title}</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">{i.reason}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={pending}
                  onClick={() => run(() => applyInsightAction(c.id, i.id), { ok: 'انجام شد' })}
                  data-testid="insight-apply"
                >
                  {label[i.type]}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="مشخصات"
        actions={
          <Button size="sm" variant="secondary" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
            {open ? 'بستن' : 'ویرایش'}
          </Button>
        }
      >
        {!open ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">تاریخ تولد</dt>
            <dd>{c.birthDate || '—'}</dd>
            <dt className="text-muted-foreground">شهر</dt>
            <dd>{c.city || '—'}</dd>
            <dt className="text-muted-foreground">برچسب‌ها</dt>
            <dd>{c.tags || '—'}</dd>
            <dt className="text-muted-foreground">منبع</dt>
            <dd>{c.source || '—'}</dd>
            <dt className="text-muted-foreground">کد دعوت</dt>
            <dd dir="ltr" className="text-start">{c.referralCode || '—'}</dd>
            <dt className="text-muted-foreground">یادداشت داخلی</dt>
            <dd className="whitespace-pre-wrap break-words">{c.notes || '—'}</dd>
          </dl>
        ) : (
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2" data-testid="c360-edit-form">
            <Field label="نام" required><Input name="firstName" defaultValue={c.firstName} required /></Field>
            <Field label="نام خانوادگی" optional><Input name="lastName" defaultValue={c.lastName} /></Field>
            <Field label="موبایل" required><Input name="phone" dir="ltr" defaultValue={c.phone} required /></Field>
            <Field label="ایمیل" optional><Input name="email" dir="ltr" defaultValue={c.email} /></Field>
            <Field label="تاریخ تولد" optional><Input name="birthDate" dir="ltr" defaultValue={c.birthDate} /></Field>
            <Field label="جنسیت" optional>
              <Select name="gender" defaultValue={c.gender}>
                <option value="">نامشخص</option>
                <option value="FEMALE">زن</option>
                <option value="MALE">مرد</option>
                <option value="OTHER">دیگر</option>
              </Select>
            </Field>
            <Field label="شهر" optional><Input name="city" defaultValue={c.city} /></Field>
            <Field label="برچسب‌ها" optional><Input name="tags" defaultValue={c.tags} /></Field>
            <Field label="منبع" optional><Input name="source" defaultValue={c.source} /></Field>
            <div className="sm:col-span-2"><Field label="یادداشت داخلی" optional><Textarea name="notes" defaultValue={c.notes} rows={2} /></Field></div>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="consent" defaultChecked={c.consent} className="mt-1 h-4 w-4 accent-[var(--color-primary,#c9a45c)]" />
              مشتری موافقت خود را با دریافت پیامک تبلیغاتی اعلام کرده است.
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" variant="gold" loading={pending}>ذخیره</Button>
            </div>
          </form>
        )}
        {p.isAdmin && !open && (
          <Button
            variant="dangerOutline"
            size="sm"
            className="mt-4"
            disabled={pending}
            onClick={() =>
              run(() => deleteCustomerAction(c.id), {
                confirm: { title: 'حذف این مشتری؟', description: 'پروفایل، حیوانات، امتیازها و سوابق او برای همیشه پاک می‌شود. مشتریانی که سفارش دارند حذف نمی‌شوند.', confirmLabel: 'حذف دائمی' },
                ok: 'مشتری حذف شد',
                after: () => (window.location.href = '/admin/customers'),
              })
            }
          >
            حذف مشتری
          </Button>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ pets */

function PetFields({ pet }: { pet?: PetView }) {
  return (
    <>
      <Field label="نام" required><Input name="name" defaultValue={pet?.name} required maxLength={40} data-testid="admin-pet-name" /></Field>
      <Field label="نوع" required>
        <Select name="species" defaultValue={pet?.species ?? 'DOG'}>
          {Object.entries(SPECIES_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </Field>
      <Field label="نژاد" optional><Input name="breed" defaultValue={pet?.breed} maxLength={40} /></Field>
      <Field label="جنسیت">
        <Select name="sex" defaultValue={pet?.sex ?? 'UNKNOWN'}>
          {Object.entries(SEX_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </Field>
      <Field label="تاریخ تولد" optional><Input name="birthDate" type="date" defaultValue={pet?.birthDate} /></Field>
      <Field label="وزن (کیلوگرم)" optional><Input name="weightKg" inputMode="decimal" defaultValue={pet?.weightKg ?? ''} /></Field>
      <Field label="عقیمی">
        <Select name="neutered" defaultValue={pet?.neutered == null ? '' : String(pet.neutered)}>
          <option value="">نامشخص</option>
          <option value="true">عقیم‌شده</option>
          <option value="false">عقیم‌نشده</option>
        </Select>
      </Field>
      <Field label="برند غذا" optional><Input name="foodBrand" defaultValue={pet?.foodBrand} maxLength={60} /></Field>
      <Field label="حساسیت‌ها" optional><Input name="allergies" defaultValue={pet?.allergies} maxLength={300} /></Field>
      <div className="sm:col-span-2"><Field label="یادداشت پزشکی (برای مشتری هم نمایش داده می‌شود)" optional><Textarea name="medicalNotes" defaultValue={pet?.medicalNotes} rows={2} maxLength={1000} /></Field></div>
    </>
  )
}

const petInput = (fd: FormData) => ({
  name: v(fd, 'name'),
  species: v(fd, 'species') as 'DOG',
  breed: v(fd, 'breed'),
  sex: v(fd, 'sex') as 'UNKNOWN',
  birthDate: v(fd, 'birthDate'),
  weightKg: v(fd, 'weightKg'),
  neutered: v(fd, 'neutered') === '' ? null : v(fd, 'neutered') === 'true',
  foodBrand: v(fd, 'foodBrand'),
  allergies: v(fd, 'allergies'),
  medicalNotes: v(fd, 'medicalNotes'),
})

function Pets(p: C360Props) {
  const { run, pending } = useAct()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const cid = p.customer.id

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="gold" size="sm" onClick={() => setAdding((x) => !x)} aria-expanded={adding} data-testid="admin-pet-add">افزودن حیوان</Button>
      </div>
      {adding && (
        <form
          className="grid gap-3 rounded-2xl border border-border-gold bg-surface-card p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            run(() => adminCreatePetAction(cid, petInput(fd) as never), { ok: 'حیوان اضافه شد', after: () => setAdding(false) })
          }}
        >
          <PetFields />
          <div className="sm:col-span-2"><Button type="submit" variant="gold" loading={pending} data-testid="admin-pet-save">ثبت حیوان</Button></div>
        </form>
      )}
      {p.pets.length === 0 && !adding && <Empty>هنوز حیوانی برای این مشتری ثبت نشده است.</Empty>}
      {p.pets.map((pet) => (
        <Card
          key={pet.id}
          title={`${pet.name} · ${SPECIES_LABEL[pet.species] ?? pet.species}${pet.breed ? ` ${pet.breed}` : ''}${pet.isActive ? '' : ' (حذف‌شده)'}`}
          actions={
            pet.isActive && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(editing === pet.id ? null : pet.id)}>ویرایش</Button>
                <Button
                  size="sm"
                  variant="dangerOutline"
                  disabled={pending}
                  onClick={() => run(() => adminDeletePetAction(cid, pet.id), { confirm: { title: `حذف ${pet.name}؟`, description: 'پروفایل حیوان از حساب مشتری حذف می‌شود.', confirmLabel: 'حذف' }, ok: 'حذف شد' })}
                >
                  حذف
                </Button>
              </div>
            )
          }
        >
          {editing === pet.id ? (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                run(() => adminUpdatePetAction(cid, pet.id, petInput(new FormData(e.currentTarget)) as never), { ok: 'ذخیره شد', after: () => setEditing(null) })
              }}
            >
              <PetFields pet={pet} />
              <div className="sm:col-span-2"><Button type="submit" variant="gold" loading={pending}>ذخیره</Button></div>
            </form>
          ) : (
            <p className="text-xs leading-7 text-muted-foreground">
              {SEX_LABEL[pet.sex]}
              {pet.birthDate ? ` · تولد ${pet.birthDate}` : ''}
              {pet.weightKg ? ` · ${faNum(pet.weightKg)} کیلوگرم` : ''}
              {pet.foodBrand ? ` · غذا: ${pet.foodBrand}` : ''}
              {pet.allergies ? ` · حساسیت: ${pet.allergies}` : ''}
              {pet.medicalNotes ? ` · ${pet.medicalNotes}` : ''}
            </p>
          )}

          {pet.isActive && (
            <form
              className="mt-3 grid grid-cols-2 items-end gap-2 sm:grid-cols-6"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                run(
                  () => adminAddRecordAction(cid, pet.id, { kind: v(fd, 'kind') as 'VACCINE', title: v(fd, 'title'), doneAt: v(fd, 'doneAt'), nextDueAt: v(fd, 'nextDueAt'), valueNumber: v(fd, 'valueNumber') as never, notes: '' }),
                  { ok: 'سابقه ثبت شد', after: () => (e.currentTarget as HTMLFormElement | null)?.reset() }
                )
              }}
            >
              <Select name="kind" aria-label="نوع سابقه" className="col-span-1">
                {Object.entries(RECORD_KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
              <Input name="title" aria-label="عنوان" placeholder="عنوان (مثلاً هاری)" required className="col-span-1 sm:col-span-2" />
              <Input name="doneAt" type="date" aria-label="تاریخ انجام" required />
              <Input name="nextDueAt" type="date" aria-label="موعد بعدی" />
              <Button type="submit" variant="outline" size="sm" disabled={pending} data-testid="admin-record-add">ثبت سابقه</Button>
            </form>
          )}

          {pet.records.length > 0 && (
            <ul className="mt-3 divide-y divide-border text-sm">
              {pet.records.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <b>{RECORD_KIND_LABEL[r.kind] ?? r.kind}</b> · {r.title}
                    <span className="text-xs text-muted-foreground"> — {r.done}{r.next ? ` · بعدی ${r.next}` : ''}{r.value ? ` · ${faNum(r.value)}` : ''}</span>
                    {r.due === 'overdue' && <Badge tone="danger" className="ms-2">عقب‌افتاده</Badge>}
                    {r.due === 'soon' && <Badge tone="warning" className="ms-2">نزدیک</Badge>}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-red-400"
                    disabled={pending}
                    onClick={() => run(() => adminDeleteRecordAction(cid, r.id), { confirm: { title: 'حذف این سابقه؟', confirmLabel: 'حذف' }, ok: 'حذف شد' })}
                  >
                    حذف
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- visits */

function Visits(p: C360Props) {
  const { run, pending } = useAct()
  const [editing, setEditing] = useState<VisitView | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [service, setService] = useState('')
  const cid = p.customer.id
  const activePets = p.pets.filter((x) => x.isActive)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = {
      petId: v(fd, 'petId') || null,
      serviceId: v(fd, 'serviceId') || null,
      serviceName: v(fd, 'serviceName'),
      visitedAt: v(fd, 'visitedAt'),
      amount: v(fd, 'amount') || '0',
      doctor: v(fd, 'doctor'),
      notes: v(fd, 'notes'),
    }
    const reset = () => {
      setEditing(null)
      setFormKey((k) => k + 1)
      setService('')
    }
    if (editing) run(() => updateVisitAction(cid, editing.id, input as never), { ok: 'مراجعه ویرایش شد و امتیاز اصلاح شد', after: reset })
    else
      run(() => recordVisitAction(cid, input as never), {
        ok: 'مراجعه ثبت شد',
        after: (r) => {
          const pts = (r.data as { pointsAwarded?: number } | undefined)?.pointsAwarded
          if (pts) toast.success(`${faNum(pts)} امتیاز برای مشتری ثبت شد`)
          reset()
        },
      })
  }

  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="space-y-4">
      <Card title={editing ? 'ویرایش مراجعه' : 'ثبت مراجعه یا خدمت کلینیک'}>
        <form key={`${formKey}-${editing?.id ?? 'new'}`} onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="visit-form">
          <Field label="خدمت از فهرست" optional>
            <Select
              name="serviceId"
              defaultValue={editing?.serviceId ?? ''}
              onChange={(e) => setService(p.services.find((s) => s.id === e.target.value)?.name ?? '')}
            >
              <option value="">— انتخاب (یا نام را آزاد بنویسید) —</option>
              {p.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="نام خدمت" required><Input name="serviceName" key={service} defaultValue={service || editing?.serviceName} required maxLength={120} data-testid="visit-service" /></Field>
          <Field label="حیوان" optional>
            <Select name="petId" defaultValue={editing?.petId ?? ''}>
              <option value="">بدون حیوان مشخص</option>
              {activePets.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
          <Field label="تاریخ مراجعه" required><Input name="visitedAt" type="date" defaultValue={editing?.dateIso ?? today} max={today} required /></Field>
          <Field label="مبلغ (تومان)" hint="امتیاز بر اساس همین مبلغ محاسبه می‌شود."><Input name="amount" inputMode="numeric" defaultValue={editing?.amount ?? 0} data-testid="visit-amount" /></Field>
          <Field label="دکتر" optional><Input name="doctor" defaultValue={editing?.doctor} maxLength={80} /></Field>
          <div className="sm:col-span-2 lg:col-span-3"><Field label="توضیحات" optional><Textarea name="notes" rows={2} defaultValue={editing?.notes} maxLength={1000} /></Field></div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" variant="gold" loading={pending} data-testid="visit-save">{editing ? 'ذخیره تغییرات' : 'ثبت و دادن امتیاز'}</Button>
            {editing && <Button type="button" variant="ghost" onClick={() => setEditing(null)}>انصراف</Button>}
          </div>
        </form>
      </Card>

      {p.visits.length === 0 ? (
        <Empty>هنوز مراجعه‌ای ثبت نشده است.</Empty>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[40rem] text-sm" data-testid="visits-table">
            <thead><tr className="border-b border-border">{['تاریخ', 'خدمت', 'حیوان', 'دکتر', 'مبلغ', 'امتیاز', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {p.visits.map((x) => (
                <tr key={x.id} data-testid="admin-visit-row">
                  <td className={td}>{x.date}</td>
                  <td className={td}>{x.serviceName}</td>
                  <td className={td}>{x.petName || '—'}</td>
                  <td className={td}>{x.doctor || '—'}</td>
                  <td className={td}>{toman(x.amount)}</td>
                  <td className={td}>{faNum(x.points)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <button type="button" className="me-3 text-xs text-primary" onClick={() => setEditing(x)}>ویرایش</button>
                    <button
                      type="button"
                      className="text-xs text-red-400"
                      disabled={pending}
                      onClick={() => run(() => deleteVisitAction(cid, x.id), { confirm: { title: 'حذف این مراجعه؟', description: 'امتیازی که بابت آن به مشتری داده شده بود، کسر می‌شود.', confirmLabel: 'حذف و کسر امتیاز' }, ok: 'حذف شد' })}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- orders */

function Orders(p: C360Props) {
  if (p.orders.length === 0) return <Empty>این مشتری هنوز سفارشی ندارد.</Empty>
  return (
    <TableWrap>
      <table className="w-full min-w-[32rem] text-sm">
        <thead><tr className="border-b border-border">{['شماره', 'تاریخ', 'وضعیت', 'مبلغ'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">
          {p.orders.map((o) => (
            <tr key={o.id}>
              <td className={td}><Link href={`/admin/orders/${o.id}`} className="font-bold text-primary hover:underline">{o.number}</Link></td>
              <td className={td}>{o.date}</td>
              <td className={td}>{(ORDER_STATUS_LABEL as Record<string, string>)[o.status] ?? o.status}</td>
              <td className={td}>{toman(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}

/* ---------------------------------------------------------------- points */

function Points(p: C360Props) {
  const { run, pending } = useAct()
  const cid = p.customer.id
  return (
    <div className="space-y-4">
      <Card title="تعدیل دستی امتیاز">
        <form
          className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const form = e.currentTarget
            run(() => adjustPointsAction(cid, Number(v(fd, 'points')), v(fd, 'note')), { ok: 'امتیاز تعدیل شد', after: () => form.reset() })
          }}
          data-testid="adjust-form"
        >
          <Field label="امتیاز (منفی = کسر)" hint={p.isAdmin ? undefined : 'بیش از ۱٬۰۰۰ امتیاز فقط با مدیر.'}><Input name="points" inputMode="numeric" dir="ltr" required placeholder="مثلاً 50 یا -20" data-testid="adjust-points" /></Field>
          <Field label="دلیل (اجباری)"><Input name="note" required minLength={3} maxLength={200} placeholder="مثلاً جبران خطای ثبت" data-testid="adjust-note" /></Field>
          <Button type="submit" variant="gold" loading={pending} data-testid="adjust-save">ثبت تعدیل</Button>
        </form>
      </Card>
      {p.ledger.length === 0 ? (
        <Empty>هنوز تراکنش امتیازی ندارد.</Empty>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[34rem] text-sm" data-testid="ledger-table">
            <thead><tr className="border-b border-border">{['تاریخ', 'نوع', 'امتیاز', 'مانده', 'توضیح'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {p.ledger.map((t) => (
                <tr key={t.id}>
                  <td className={`${td} whitespace-nowrap`}>{t.date}</td>
                  <td className={td}>{POINTS_KIND_LABEL[t.kind] ?? t.kind}</td>
                  <td className={`${td} font-bold ${t.points > 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr" style={{ textAlign: 'start' }}>{t.points > 0 ? '+' : ''}{faNum(t.points)}</td>
                  <td className={td}>{faNum(t.balance)}</td>
                  <td className={td}>{t.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- coupons */

function Coupons(p: C360Props) {
  const { run, pending } = useAct()
  const [type, setType] = useState('PERCENT')
  const [made, setMade] = useState<string | null>(null)
  const cid = p.customer.id
  return (
    <div className="space-y-4">
      <Card title="ساخت کد تخفیف شخصی (یک‌بار مصرف، فقط برای همین مشتری)">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            run(
              () => createPersonalCouponAction(cid, { type: type as 'PERCENT', value: v(fd, 'value') as never, maxDiscount: (v(fd, 'max') || null) as never, minSubtotal: (v(fd, 'min') || 0) as never, validDays: (v(fd, 'days') || 14) as never }),
              { ok: 'کد ساخته شد', after: (r) => setMade((r.data as { code: string } | undefined)?.code ?? null) }
            )
          }}
          data-testid="coupon-form"
        >
          <Field label="نوع">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="PERCENT">درصدی</option>
              <option value="FIXED">مبلغ ثابت (تومان)</option>
              <option value="FREE_SHIPPING">ارسال رایگان</option>
            </Select>
          </Field>
          {type !== 'FREE_SHIPPING' && <Field label={type === 'PERCENT' ? 'درصد' : 'مبلغ'}><Input name="value" inputMode="numeric" required defaultValue={type === 'PERCENT' ? 10 : 50000} data-testid="coupon-value" /></Field>}
          {type === 'PERCENT' && <Field label="سقف تخفیف" optional><Input name="max" inputMode="numeric" defaultValue={150000} /></Field>}
          <Field label="حداقل خرید" optional><Input name="min" inputMode="numeric" defaultValue={0} /></Field>
          <Field label="اعتبار (روز)"><Input name="days" inputMode="numeric" defaultValue={14} /></Field>
          <Button type="submit" variant="gold" loading={pending} data-testid="coupon-save">ساخت کد</Button>
        </form>
        {made && <Alert tone="success" className="mt-3">کد ساخته شد: <code dir="ltr" className="font-bold" data-testid="coupon-made">{made}</code></Alert>}
      </Card>
      {p.coupons.length === 0 ? (
        <Empty>این مشتری کد تخفیف اختصاصی ندارد.</Empty>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[30rem] text-sm">
            <thead><tr className="border-b border-border">{['کد', 'عنوان', 'منبع', 'اعتبار تا', 'وضعیت'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {p.coupons.map((k) => (
                <tr key={k.id}>
                  <td className={td} dir="ltr" style={{ textAlign: 'start' }}><b>{k.code}</b></td>
                  <td className={td}>{k.title || '—'}</td>
                  <td className={td}>{k.source || '—'}</td>
                  <td className={td}>{k.ends ?? '—'}</td>
                  <td className={td}>{k.used ? <Badge tone="success">استفاده شد</Badge> : k.active ? <Badge tone="gold">فعال</Badge> : <Badge tone="neutral">غیرفعال</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- messages */

const GOALS: [string, string][] = [['winback', 'بازگرداندن مشتری'], ['vaccine', 'یادآوری واکسن'], ['birthday', 'تولد'], ['repeatPurchase', 'خرید مجدد'], ['abandonedCart', 'سبد رهاشده'], ['promo', 'پیشنهاد ویژه'], ['tierUp', 'ارتقای سطح'], ['welcome', 'خوش‌آمدگویی']]

function Messages(p: C360Props) {
  const { run, pending } = useAct()
  const [body, setBody] = useState('')
  const [goal, setGoal] = useState('promo')
  const [tone, setTone] = useState('friendly')
  const [options, setOptions] = useState<string[]>([])
  const [src, setSrc] = useState<'ai' | 'fallback' | null>(null)
  const cid = p.customer.id
  const len = Array.from(body).length

  const draft = () =>
    run(() => draftMessageAction(goal, tone, cid), {
      after: (r) => {
        const d = r.data as { options: string[]; source: 'ai' | 'fallback' } | undefined
        setOptions(d?.options ?? [])
        setSrc(d?.source ?? null)
      },
    })

  return (
    <div className="space-y-4">
      {p.senderNote && <Alert tone="warning" title="سرویس پیامک متصل نیست">{p.senderNote}</Alert>}
      {!p.customer.consent && <Alert tone="warning">این مشتری رضایت دریافت پیامک تبلیغاتی نداده است؛ ارسال پیام رد می‌شود.</Alert>}
      <Card title="ارسال پیام به این مشتری">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="هدف پیام"><Select value={goal} onChange={(e) => setGoal(e.target.value)}>{GOALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <Field label="لحن"><Select value={tone} onChange={(e) => setTone(e.target.value)}><option value="friendly">صمیمی</option><option value="formal">رسمی</option><option value="playful">شاد</option></Select></Field>
            <Button variant="outline" onClick={draft} disabled={pending} data-testid="ai-draft">پیشنهاد متن با هوش مصنوعی</Button>
          </div>
          {options.length > 0 && (
            <div className="space-y-2" data-testid="draft-options">
              <p className="text-xs text-muted-foreground">{src === 'ai' ? 'پیشنهادهای هوش مصنوعی (بدون ارسال نام یا شماره مشتری به سرویس):' : 'پیشنهادهای آماده (اتصال هوش مصنوعی فعال نیست):'}</p>
              {options.map((o, i) => (
                <button key={i} type="button" onClick={() => setBody(o)} className="block w-full rounded-xl border border-border bg-surface p-3 text-start text-sm leading-7 hover:border-primary">{o}</button>
              ))}
            </div>
          )}
          <Field label="متن پیام" hint="متغیرها: {name} {petName} {points} {tier} {link} — جایگزینی خودکار انجام می‌شود. «لغو: ارسال ۱» به انتهای پیام اضافه می‌شود.">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={640} data-testid="msg-body" />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{faNum(len)} نویسه</span>
            <Button variant="gold" disabled={pending || !body.trim()} loading={pending} onClick={() => run(() => sendCustomerMessageAction(cid, body), { ok: 'پیام در صف ارسال قرار گرفت', after: () => setBody('') })} data-testid="msg-send">
              ارسال پیام
            </Button>
          </div>
        </div>
      </Card>
      {p.messages.length === 0 ? (
        <Empty>تاکنون پیامی برای این مشتری ثبت نشده است.</Empty>
      ) : (
        <ul className="space-y-2" data-testid="messages-list">
          {p.messages.map((m) => (
            <li key={m.id} className="rounded-xl border border-border bg-surface-card p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge tone={MSG_STATUS[m.status]?.tone ?? 'neutral'}>{MSG_STATUS[m.status]?.label ?? m.status}</Badge>
                <span>{m.kind}</span>
                <span>{m.date}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words leading-7">{m.body}</p>
              {m.error && <p className="mt-1 text-xs text-red-400">{m.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- notes */

function Notes(p: C360Props) {
  const { run, pending } = useAct()
  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget
          const body = v(new FormData(form), 'body')
          run(() => addCustomerNoteAction(p.customer.id, body), { ok: 'یادداشت ثبت شد', after: () => form.reset() })
        }}
      >
        <div className="flex-1"><Field label="یادداشت جدید"><Textarea name="body" rows={2} required maxLength={1000} data-testid="note-body" /></Field></div>
        <Button type="submit" variant="gold" loading={pending} data-testid="note-save">ثبت یادداشت</Button>
      </form>
      {p.notes.length === 0 ? (
        <Empty>یادداشتی ثبت نشده است.</Empty>
      ) : (
        <ol className="space-y-2" data-testid="notes-list">
          {p.notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-border bg-surface-card p-3 text-sm">
              <p className="whitespace-pre-wrap break-words leading-7">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n.by} · {n.date}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ cart */

function Cart(p: C360Props) {
  const { run, pending } = useAct()
  const [pct, setPct] = useState('10')
  if (!p.cart || p.cart.items.length === 0) return <Empty>سبد خرید این مشتری فعلاً خالی است.</Empty>
  return (
    <Card title={`سبد فعلی · آخرین تغییر ${p.cart.updated}`}>
      <ul className="divide-y divide-border text-sm">
        {p.cart.items.map((i, k) => (
          <li key={k} className="flex flex-wrap justify-between gap-2 py-2"><span>{i.name} × {faNum(i.quantity)}</span><span>{toman(i.price * i.quantity)}</span></li>
        ))}
      </ul>
      <p className="mt-3 text-sm font-bold">جمع: {toman(p.cart.subtotal)}</p>
      {p.cart.reminded && <p className="mt-1 text-xs text-muted-foreground">آخرین یادآوری: {p.cart.reminded}</p>}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Field label="تخفیف یادآوری (٪)" hint="۰ یعنی بدون کد"><Input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="numeric" className="w-28" /></Field>
        <Button variant="gold" disabled={pending} onClick={() => run(() => sendCartReminderAction(p.customer.id, Number(pct)), { ok: 'یادآوری در صف قرار گرفت' })}>ارسال یادآوری</Button>
      </div>
    </Card>
  )
}
