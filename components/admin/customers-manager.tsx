'use client'

import { useState, useTransition } from 'react'
import { Link, useRouter } from '@/i18n/routing'
import { resetCustomerPasswordAction, setCustomerBlockedAction } from '@/app/actions/admin-orders'
import { createCustomerAction, exportCustomersCsvAction } from '@/app/actions/admin-club'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toaster'
import { SPECIES_LABEL } from '@/lib/club/pet-math'
import { faNum, toman } from '@/components/admin/format'
import { Empty, TIER_TONE, TableWrap, td, th } from '@/components/admin/club/kit'
import { BulkBar, lifecycleBadge, churnBadge, LIFECYCLE_FA } from '@/components/admin/kit'
import { SavedViews } from '@/components/admin/crm/saved-views'
import { bulkAssignCustomersAction, bulkTagCustomersAction } from '@/app/actions/crm-customers'

export interface AdminCustomerRow {
  id: string
  name: string
  phone: string
  email: string | null
  city: string | null
  joined: string
  lastOrder: string | null
  orders: number
  spent: number
  points: number
  tier: string
  consent: boolean
  isBlocked: boolean
  createdByAdmin: boolean
  pets: string[]
  lifecycle: string | null
  health: number | null
  churn: string | null
  ownerId: string | null
}

interface Filters {
  q: string
  tier: string
  species: string
  tag: string
  city: string
  orders: string
  consent: string
  owner: string
  lifecycle: string
  churn: string
  sort: string
  dir: string
}

export function CustomersManager({
  customers,
  filters,
  total,
  page,
  pages,
  tiers,
  isAdmin,
  staff,
}: {
  customers: AdminCustomerRow[]
  filters: Filters
  total: number
  page: number
  pages: number
  tiers: { key: string; label: string; color: string }[]
  isAdmin: boolean
  staff: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [f, setF] = useState(filters)
  const [pending, start] = useTransition()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Shown once, right after a reset; leaves the screen on reload and is never stored.
  const [temp, setTemp] = useState<{ name: string; phone: string; password: string } | null>(null)
  const tierMap = Object.fromEntries(tiers.map((t) => [t.key, t]))
  const staffMap = Object.fromEntries(staff.map((m) => [m.id, m.name]))
  const [selected, setSelected] = useState<string[]>([])

  const qs = (over: Partial<Filters> & { page?: number } = {}) => {
    const merged: Record<string, string> = { ...filters, ...over } as unknown as Record<string, string>
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) if (v && k !== 'page') p.set(k, String(v))
    if (over.page && over.page > 1) p.set('page', String(over.page))
    const s = p.toString()
    return `/admin/customers${s ? `?${s}` : ''}`
  }

  const sortLink = (key: string, label: string) => {
    const active = filters.sort === key
    return (
      <Link href={qs({ sort: key, dir: active && filters.dir === 'desc' ? 'asc' : 'desc' })} className="inline-flex items-center gap-1 hover:text-primary">
        {label}
        {active && <span aria-hidden>{filters.dir === 'desc' ? '↓' : '↑'}</span>}
      </Link>
    )
  }

  const resetPassword = (c: AdminCustomerRow) =>
    start(async () => {
      const ok = await confirmDialog({
        title: `رمز موقت برای ${c.name}؟`,
        description:
          'یک رمز عبور موقت ساخته می‌شود و مشتری از همه دستگاه‌ها خارج می‌شود. فقط پس از تماس تلفنی و اطمینان از هویت مشتری، رمز را به او اطلاع دهید.',
        confirmLabel: 'ساخت رمز موقت',
      })
      if (!ok) return
      const res = await resetCustomerPasswordAction(c.id)
      if (res.error || !res.password) {
        toast.error('بازنشانی انجام نشد', res.error)
        return
      }
      setTemp({ name: c.name, phone: c.phone, password: res.password })
    })

  const exportCsv = () =>
    start(async () => {
      const r = await exportCustomersCsvAction({
        q: filters.q,
        tier: filters.tier || undefined,
        species: filters.species || undefined,
        tag: filters.tag || undefined,
        city: filters.city || undefined,
        hasOrders: filters.orders === 'yes' ? true : filters.orders === 'no' ? false : undefined,
        consent: filters.consent === 'yes' ? true : filters.consent === 'no' ? false : undefined,
        owner: filters.owner || undefined,
        lifecycle: filters.lifecycle || undefined,
        churn: (filters.churn || undefined) as 'LOW' | 'MEDIUM' | 'HIGH' | undefined,
      })
      if (!r.ok || !r.data) return void toast.error(r.error ?? 'خروجی ساخته نشد')
      const url = URL.createObjectURL(new Blob([r.data.csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'customers.csv'
      a.click()
      URL.revokeObjectURL(url)
    })

  const [bulkTag, setBulkTag] = useState('')
  const [bulkOwner, setBulkOwner] = useState('')

  const afterBulk = (n: number, what: string) => {
    toast.success(`${faNum(n)} مشتری ${what}`)
    setSelected([])
    router.refresh()
  }

  const bulkAssign = () =>
    start(async () => {
      const r = await bulkAssignCustomersAction(selected, bulkOwner === '__none' ? null : bulkOwner)
      if (!r.ok) return void toast.error(r.error)
      afterBulk(r.data.updated, 'به مسئول سپرده شد')
    })

  const bulkTagRun = (mode: 'add' | 'remove') =>
    start(async () => {
      const r = await bulkTagCustomersAction(selected, bulkTag, mode)
      if (!r.ok) return void toast.error(r.error)
      afterBulk(r.data.updated, mode === 'add' ? 'برچسب خورد' : 'برچسبش برداشته شد')
    })

  const toggleAll = () => setSelected((cur) => (cur.length === customers.length ? [] : customers.map((c) => c.id)))
  const toggleOne = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const submitCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const g = (k: string) => String(fd.get(k) ?? '')
    start(async () => {
      const r = await createCustomerAction({
        firstName: g('firstName'),
        lastName: g('lastName'),
        phone: g('phone'),
        email: g('email'),
        birthDate: g('birthDate'),
        city: g('city'),
        tags: g('tags'),
        notes: g('notes'),
        source: g('source') || 'clinic',
        marketingSmsConsent: fd.get('consent') === 'on',
      })
      if (!r.ok || !r.data) return void setError(r.error ?? 'ثبت انجام نشد.')
      toast.success('پروفایل مشتری ساخته شد')
      router.push(`/admin/customers/${r.data.id}`)
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">مشتریان باشگاه</h1>
          <p className="mt-1 text-sm text-muted-foreground">{faNum(total)} مشتری؛ پروفایل کامل، حیوانات، خدمات و امتیاز هر نفر را از ردیف او ببینید.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/customers/duplicates" className="btn btn-secondary btn-sm" data-testid="customers-duplicates-link">
            تکراری‌ها
          </Link>
          {isAdmin && (
            <Link href="/admin/customers/import" className="btn btn-secondary btn-sm" data-testid="customers-import-link">
              ورود از فایل
            </Link>
          )}
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={pending} data-testid="customers-export">
            خروجی CSV
          </Button>
          <Button variant="gold" size="sm" onClick={() => setCreating((v) => !v)} aria-expanded={creating} data-testid="customer-create-toggle">
            ایجاد مشتری
          </Button>
        </div>
      </div>

      {creating && (
        <form onSubmit={submitCreate} className="grid gap-3 rounded-2xl border border-border-gold bg-surface-card p-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="customer-create-form">
          <p className="text-xs leading-6 text-muted-foreground sm:col-span-2 lg:col-span-3">
            پروفایل برای مشتری حضوری کلینیک. وقتی او با همین شماره با کد پیامکی وارد سایت شود، پروفایل، حیوانات و امتیازهایش را تحویل می‌گیرد.
          </p>
          {error && (
            <div className="sm:col-span-2 lg:col-span-3">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          <Field label="نام" required>
            <Input name="firstName" required maxLength={60} />
          </Field>
          <Field label="نام خانوادگی" optional>
            <Input name="lastName" maxLength={60} />
          </Field>
          <Field label="موبایل" required>
            <Input name="phone" dir="ltr" inputMode="tel" required placeholder="09123456789" />
          </Field>
          <Field label="ایمیل" optional>
            <Input name="email" dir="ltr" type="email" />
          </Field>
          <Field label="تاریخ تولد" optional hint="مثل ۱۳۷۰/۰۵/۱۲ یا 1991-08-03">
            <Input name="birthDate" dir="ltr" />
          </Field>
          <Field label="شهر" optional>
            <Input name="city" maxLength={40} />
          </Field>
          <Field label="برچسب‌ها" optional hint="با ویرگول جدا کنید">
            <Input name="tags" />
          </Field>
          <Field label="منبع آشنایی" optional>
            <Input name="source" defaultValue="clinic" maxLength={40} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="یادداشت داخلی" optional>
              <Textarea name="notes" rows={2} maxLength={2000} />
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm sm:col-span-2 lg:col-span-3">
            <input type="checkbox" name="consent" className="mt-1 h-4 w-4 accent-[var(--color-primary,#c9a45c)]" />
            مشتری موافقت کرده پیامک‌های تبلیغاتی و یادآوری باشگاه را دریافت کند (فقط در صورت تأیید خود او تیک بزنید).
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" variant="gold" loading={pending} data-testid="customer-create-save">
              ثبت مشتری
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              انصراف
            </Button>
          </div>
        </form>
      )}

      <form
        onSubmit={(e) => (e.preventDefault(), router.push(qs({ ...f, page: 1 })))}
        className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface-card p-3 sm:grid-cols-3 lg:grid-cols-6"
        role="search"
        aria-label="جستجو و فیلتر مشتریان"
      >
        <Input className="col-span-2 sm:col-span-3 lg:col-span-2" aria-label="جستجو" placeholder="نام، موبایل، ایمیل یا نام حیوان" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} data-testid="customers-search" />
        <Select aria-label="سطح" value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value })}>
          <option value="">همه سطح‌ها</option>
          {tiers.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select aria-label="نوع حیوان" value={f.species} onChange={(e) => setF({ ...f, species: e.target.value })}>
          <option value="">همه حیوانات</option>
          {Object.entries(SPECIES_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select aria-label="سابقه خرید" value={f.orders} onChange={(e) => setF({ ...f, orders: e.target.value })}>
          <option value="">خرید: همه</option>
          <option value="yes">دارای سفارش</option>
          <option value="no">بدون سفارش</option>
        </Select>
        <Select aria-label="رضایت پیامک" value={f.consent} onChange={(e) => setF({ ...f, consent: e.target.value })}>
          <option value="">پیامک: همه</option>
          <option value="yes">رضایت دارد</option>
          <option value="no">رضایت ندارد</option>
        </Select>
        <Select aria-label="مرحلهٔ چرخهٔ مشتری" value={f.lifecycle} onChange={(e) => setF({ ...f, lifecycle: e.target.value })} data-testid="customers-filter-lifecycle">
          <option value="">مرحله: همه</option>
          {Object.entries(LIFECYCLE_FA).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select aria-label="ریسک ریزش" value={f.churn} onChange={(e) => setF({ ...f, churn: e.target.value })} data-testid="customers-filter-churn">
          <option value="">ریزش: همه</option>
          <option value="HIGH">ریسک بالا</option>
          <option value="MEDIUM">ریسک متوسط</option>
          <option value="LOW">ریسک کم</option>
        </Select>
        <Select aria-label="مسئول" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} data-testid="customers-filter-owner">
          <option value="">مسئول: همه</option>
          <option value="none">بدون مسئول</option>
          {staff.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Input aria-label="برچسب" placeholder="برچسب" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} />
        <Input aria-label="شهر" placeholder="شهر" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" size="sm">
            اعمال
          </Button>
          <Link href="/admin/customers" className="btn btn-ghost btn-sm">
            پاک‌سازی
          </Link>
        </div>
      </form>

      <SavedViews
        entity="CUSTOMER"
        canShare={isAdmin}
        current={{ q: filters.q, tier: filters.tier, species: filters.species, tag: filters.tag, city: filters.city, orders: filters.orders, consent: filters.consent, owner: filters.owner, lifecycle: filters.lifecycle, churn: filters.churn }}
        onApply={(v) => router.push(qs({ q: '', tier: '', species: '', tag: '', city: '', orders: '', consent: '', owner: '', lifecycle: '', churn: '', ...v, page: 1 }))}
      />

      {selected.length > 0 && (
        <div className="space-y-2" data-testid="customers-bulk">
          <BulkBar count={selected.length} onClear={() => setSelected([])} actions={[]} />
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3">
            <Select aria-label="مسئول گروهی" controlSize="sm" className="w-44" value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)} data-testid="bulk-owner">
              <option value="">انتخاب مسئول…</option>
              <option value="__none">بدون مسئول</option>
              {staff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="secondary" disabled={pending || !bulkOwner} onClick={bulkAssign} data-testid="bulk-assign">
              سپردن به مسئول
            </Button>
            <Input aria-label="برچسب گروهی" controlSize="sm" className="w-36" placeholder="برچسب" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} data-testid="bulk-tag" />
            <Button size="sm" variant="secondary" disabled={pending || !bulkTag.trim()} onClick={() => bulkTagRun('add')} data-testid="bulk-tag-add">
              افزودن برچسب
            </Button>
            <Button size="sm" variant="ghost" disabled={pending || !bulkTag.trim()} onClick={() => bulkTagRun('remove')}>
              برداشتن برچسب
            </Button>
          </div>
        </div>
      )}

      {temp && (
        <Alert tone="warning" title={`رمز موقت ${temp.name} (${temp.phone})`}>
          <p className="leading-7">
            این رمز فقط همین یک بار نمایش داده می‌شود. آن را تلفنی به مشتری بدهید و بگویید پس از ورود، از «اطلاعات حساب» رمز جدید
            بسازد.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code dir="ltr" className="rounded-lg bg-surface px-3 py-2 text-base font-bold tracking-wider text-primary">
              {temp.password}
            </code>
            <button type="button" className="text-xs font-bold text-primary" onClick={() => navigator.clipboard?.writeText(temp.password).then(() => toast.success('کپی شد'))}>
              کپی
            </button>
            <button type="button" className="text-xs text-muted-foreground" onClick={() => setTemp(null)}>
              بستن
            </button>
          </div>
        </Alert>
      )}

      {customers.length === 0 ? (
        <Empty>مشتری‌ای با این فیلترها پیدا نشد.</Empty>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[72rem] text-sm" data-testid="customers-table">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>
                  <input type="checkbox" aria-label="انتخاب همه" checked={selected.length === customers.length && customers.length > 0} onChange={toggleAll} data-testid="customers-select-all" />
                </th>
                <th className={th}>مشتری</th>
                <th className={th}>مرحله</th>
                <th className={th}>سلامت</th>
                <th className={th}>مسئول</th>
                <th className={th}>حیوانات</th>
                <th className={th}>سطح</th>
                <th className={th}>{sortLink('points', 'امتیاز')}</th>
                <th className={th}>{sortLink('orders', 'سفارش')}</th>
                <th className={th}>{sortLink('spend', 'مجموع خرید')}</th>
                <th className={th}>{sortLink('lastOrder', 'آخرین سفارش')}</th>
                <th className={th}>{sortLink('joined', 'عضویت')}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c) => (
                <tr key={c.id} className={c.isBlocked ? 'opacity-60' : ''} data-testid="customer-row">
                  <td className={td}>
                    <input type="checkbox" aria-label={`انتخاب ${c.name}`} checked={selected.includes(c.id)} onChange={() => toggleOne(c.id)} data-testid="customer-select" />
                  </td>
                  <td className={td}>
                    <Link href={`/admin/customers/${c.id}`} className="font-bold text-primary hover:underline">
                      {c.name}
                    </Link>
                    <div dir="ltr" className="text-start text-xs text-muted-foreground">
                      {c.phone}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.createdByAdmin && (
                        <Badge tone="info" size="sm">
                          ثبت توسط کلینیک
                        </Badge>
                      )}
                      {!c.consent && (
                        <Badge tone="neutral" size="sm">
                          بدون رضایت پیامک
                        </Badge>
                      )}
                      {c.isBlocked && (
                        <Badge tone="danger" size="sm">
                          مسدود
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className={td}>{c.lifecycle ? lifecycleBadge(c.lifecycle as keyof typeof LIFECYCLE_FA) : <span className="text-muted-foreground">—</span>}</td>
                  <td className={td}>
                    {c.health === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5" data-testid="customer-health">
                        <b>{faNum(c.health)}</b>
                        {c.churn && churnBadge(c.churn)}
                      </span>
                    )}
                  </td>
                  <td className={td}>{c.ownerId ? staffMap[c.ownerId] ?? 'کاربر حذف‌شده' : <span className="text-muted-foreground">—</span>}</td>
                  <td className={td}>{c.pets.length ? c.pets.join('، ') : <span className="text-muted-foreground">—</span>}</td>
                  <td className={td}>
                    <span className="rounded-full border px-2 py-0.5 text-xs font-bold" style={TIER_TONE(tierMap[c.tier]?.color ?? '#999')}>
                      {tierMap[c.tier]?.label ?? c.tier}
                    </span>
                  </td>
                  <td className={td}>{faNum(c.points)}</td>
                  <td className={td}>{faNum(c.orders)}</td>
                  <td className={`${td} whitespace-nowrap`}>{toman(c.spent)}</td>
                  <td className={td}>{c.lastOrder ?? '—'}</td>
                  <td className={td}>{c.joined}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {isAdmin && (
                      <>
                        <button disabled={pending} onClick={() => resetPassword(c)} className="me-3 text-xs text-primary">
                          رمز موقت
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => start(async () => (await setCustomerBlockedAction(c.id, !c.isBlocked), router.refresh()))}
                          className={`text-xs ${c.isBlocked ? 'text-emerald-400' : 'text-red-400'}`}
                        >
                          {c.isBlocked ? 'فعال‌سازی' : 'مسدود کردن'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={pages} hrefFor={(p) => qs({ page: p })} />
    </div>
  )
}
