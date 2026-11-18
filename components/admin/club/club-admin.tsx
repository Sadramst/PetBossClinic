'use client'

import { useState } from 'react'
import { Link } from '@/i18n/routing'
import { deleteRewardAction, saveLoyaltyConfigAction, saveRewardAction } from '@/app/actions/admin-club'
import type { ClubReport } from '@/lib/club/reports'
import type { TierDef } from '@/lib/club/tiers'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { faNum, toman } from '@/components/admin/format'
import { Card, Empty, Stat, TableWrap, td, th, useAct } from '@/components/admin/club/kit'

interface Config {
  enabled: boolean
  pointsPerThousandToman: number
  serviceMultiplier: number
  signupBonus: number
  firstPetBonus: number
  petProfileBonus: number
  reviewBonus: number
  birthdayBonus: number
  referralGiven: number
  referralJoined: number
  pointValueToman: number
  pointsExpireMonths: number | null
}

interface RewardView {
  id: string
  title: string
  description: string
  pointsCost: number
  couponType: string
  couponValue: number
  couponMaxDiscount: number | null
  couponMinSubtotal: number
  couponValidDays: number
  minTier: string
  stock: number | null
  redeemedCount: number
  isActive: boolean
  sortOrder: number
}

const BONUS_FIELDS: [keyof Config, string, string][] = [
  ['signupBonus', 'هدیه عضویت', 'امتیاز اولین ورود'],
  ['firstPetBonus', 'ثبت اولین حیوان', ''],
  ['petProfileBonus', 'تکمیل پروفایل حیوان', 'نژاد، تاریخ تولد و عکس یا وزن'],
  ['reviewBonus', 'ثبت نظر', ''],
  ['birthdayBonus', 'هدیه تولد', 'با فعال بودن خودکارسازی تولد'],
  ['referralGiven', 'دعوت‌کننده', 'پس از اولین خرید دوست دعوت‌شده'],
  ['referralJoined', 'دعوت‌شده', 'پس از اولین خرید خودش'],
]

export function ClubAdmin({ config, tiers, rewards, report, canEditConfig }: { config: Config; tiers: TierDef[]; rewards: RewardView[]; report: ClubReport; canEditConfig: boolean }) {
  const tierLabel = (k: string) => tiers.find((t) => t.key === k)?.label ?? k
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">باشگاه مشتریان</h1>
        <p className="mt-1 text-sm text-muted-foreground">قوانین امتیاز، سطح‌ها و جوایز را تنظیم کنید و وضعیت باشگاه را ببینید.</p>
      </div>
      <Tabs
        label="بخش‌های باشگاه"
        variant="pills"
        tabs={[
          { id: 'report', label: 'گزارش باشگاه', content: <Report report={report} tierLabel={tierLabel} tiers={tiers} /> },
          { id: 'rewards', label: 'جوایز', count: rewards.length, content: <Rewards rewards={rewards} tiers={tiers} canDelete={canEditConfig} /> },
          { id: 'config', label: 'تنظیمات امتیاز و سطح‌ها', content: <ConfigForm config={config} tiers={tiers} canEdit={canEditConfig} /> },
        ]}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- report */

function Report({ report: r, tierLabel, tiers }: { report: ClubReport; tierLabel: (k: string) => string; tiers: TierDef[] }) {
  return (
    <div className="space-y-4" data-testid="club-report">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="اعضای باشگاه" value={faNum(r.members)} testId="rep-members" />
        <Stat label="فعال در ۳۰ روز اخیر" value={faNum(r.activeThisMonth)} hint="خرید یا خدمت" />
        <Stat label="امتیاز در گردش" value={faNum(r.pointsOutstanding)} testId="rep-outstanding" />
        <Stat label="بدهی باشگاه" value={toman(r.liabilityToman)} hint="امتیاز در گردش × ارزش هر امتیاز" testId="rep-liability" />
        <Stat label="امتیاز صادرشده (۳۰ روز)" value={faNum(r.issued30)} hint={`کل: ${faNum(r.issuedAll)}`} />
        <Stat label="امتیاز خرج‌شده (۳۰ روز)" value={faNum(r.redeemed30)} hint={`کل: ${faNum(r.redeemedAll)}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="اعضا به تفکیک سطح">
          <ul className="space-y-2 text-sm">
            {tiers.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-2">
                <span className="rounded-full border px-2 py-0.5 text-xs font-bold" style={{ borderColor: t.color, color: t.color }}>{t.label}</span>
                <b>{faNum(r.byTier[t.key] ?? 0)}</b>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="جوایز پرطرفدار">
          {r.topRewards.length === 0 ? <Empty>هنوز جایزه‌ای دریافت نشده است.</Empty> : (
            <ol className="space-y-2 text-sm">{r.topRewards.map((x, i) => <li key={i} className="flex justify-between gap-2"><span className="min-w-0 truncate">{x.title}</span><b>{faNum(x.count)}</b></li>)}</ol>
          )}
        </Card>
        <Card title="برترین امتیازگیرها">
          {r.topEarners.length === 0 ? <Empty>هنوز امتیازی صادر نشده است.</Empty> : (
            <ol className="space-y-2 text-sm">
              {r.topEarners.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <Link href={`/admin/customers/${c.id}`} className="min-w-0 truncate text-primary hover:underline">{c.name} <span className="text-xs text-muted-foreground">({tierLabel(c.tier)})</span></Link>
                  <b>{faNum(c.lifetimePoints)}</b>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- rewards */

function Rewards({ rewards, tiers, canDelete }: { rewards: RewardView[]; tiers: TierDef[]; canDelete: boolean }) {
  const { run, pending } = useAct()
  const [editing, setEditing] = useState<RewardView | 'new' | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="gold" size="sm" onClick={() => setEditing('new')} data-testid="reward-new">جایزه جدید</Button></div>
      {editing && <RewardForm key={editing === 'new' ? 'new' : editing.id} reward={editing === 'new' ? null : editing} tiers={tiers} onDone={() => setEditing(null)} />}
      {rewards.length === 0 ? <Empty>هنوز جایزه‌ای تعریف نشده است. اولین جایزه را بسازید تا مشتریان امتیازشان را خرج کنند.</Empty> : (
        <TableWrap>
          <table className="w-full min-w-[40rem] text-sm" data-testid="rewards-table">
            <thead><tr className="border-b border-border">{['جایزه', 'هزینه', 'کد تخفیف', 'سطح', 'موجودی', 'دریافت‌شده', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {rewards.map((r) => (
                <tr key={r.id} className={r.isActive ? '' : 'opacity-60'}>
                  <td className={td}><b>{r.title}</b>{!r.isActive && <Badge tone="neutral" className="ms-2">غیرفعال</Badge>}</td>
                  <td className={td}>{faNum(r.pointsCost)} امتیاز</td>
                  <td className={td}>{r.couponType === 'PERCENT' ? `${faNum(r.couponValue)}٪` : r.couponType === 'FIXED' ? toman(r.couponValue) : 'ارسال رایگان'}</td>
                  <td className={td}>{r.minTier ? tiers.find((t) => t.key === r.minTier)?.label ?? r.minTier : 'همه'}</td>
                  <td className={td}>{r.stock === null ? 'نامحدود' : faNum(r.stock)}</td>
                  <td className={td}>{faNum(r.redeemedCount)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <button className="me-3 text-xs text-primary" onClick={() => setEditing(r)}>ویرایش</button>
                    {canDelete && (
                      <button className="text-xs text-red-400" disabled={pending} onClick={() => run(() => deleteRewardAction(r.id), { confirm: { title: `حذف «${r.title}»؟`, description: 'اگر قبلاً دریافت شده باشد، به‌جای حذف غیرفعال می‌شود.', confirmLabel: 'حذف' }, ok: 'انجام شد' })}>حذف</button>
                    )}
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

function RewardForm({ reward, tiers, onDone }: { reward: RewardView | null; tiers: TierDef[]; onDone: () => void }) {
  const { run, pending } = useAct()
  const [type, setType] = useState(reward?.couponType ?? 'PERCENT')
  const [active, setActive] = useState(reward?.isActive ?? true)
  return (
    <form
      className="grid gap-3 rounded-2xl border border-border-gold bg-surface-card p-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="reward-form"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const g = (k: string) => String(fd.get(k) ?? '')
        run(
          () =>
            saveRewardAction(reward?.id ?? null, {
              title: g('title'),
              description: g('description'),
              pointsCost: g('pointsCost'),
              couponType: type as 'PERCENT',
              couponValue: g('couponValue') || 0,
              couponMaxDiscount: g('couponMaxDiscount') || null,
              couponMinSubtotal: g('couponMinSubtotal') || 0,
              couponValidDays: g('couponValidDays') || 30,
              minTier: g('minTier') || null,
              stock: g('stock') || null,
              isActive: active,
              sortOrder: g('sortOrder') || 0,
            } as never),
          { ok: 'جایزه ذخیره شد', after: onDone }
        )
      }}
    >
      <Field label="عنوان" required><Input name="title" defaultValue={reward?.title} required maxLength={80} data-testid="reward-title" /></Field>
      <Field label="هزینه (امتیاز)" required><Input name="pointsCost" inputMode="numeric" defaultValue={reward?.pointsCost ?? 500} required data-testid="reward-cost" /></Field>
      <Field label="نوع تخفیف">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="PERCENT">درصدی</option>
          <option value="FIXED">مبلغ ثابت (تومان)</option>
          <option value="FREE_SHIPPING">ارسال رایگان</option>
        </Select>
      </Field>
      {type !== 'FREE_SHIPPING' && <Field label={type === 'PERCENT' ? 'درصد' : 'مبلغ'}><Input name="couponValue" inputMode="numeric" defaultValue={reward?.couponValue ?? (type === 'PERCENT' ? 10 : 50000)} data-testid="reward-value" /></Field>}
      {type === 'PERCENT' && <Field label="سقف تخفیف (تومان)" optional><Input name="couponMaxDiscount" inputMode="numeric" defaultValue={reward?.couponMaxDiscount ?? ''} /></Field>}
      <Field label="حداقل سبد خرید" optional><Input name="couponMinSubtotal" inputMode="numeric" defaultValue={reward?.couponMinSubtotal ?? 0} /></Field>
      <Field label="اعتبار کد (روز)"><Input name="couponValidDays" inputMode="numeric" defaultValue={reward?.couponValidDays ?? 30} /></Field>
      <Field label="حداقل سطح" optional>
        <Select name="minTier" defaultValue={reward?.minTier ?? ''}>
          <option value="">همه اعضا</option>
          {tiers.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </Select>
      </Field>
      <Field label="موجودی" optional hint="خالی = نامحدود"><Input name="stock" inputMode="numeric" defaultValue={reward?.stock ?? ''} /></Field>
      <Field label="ترتیب نمایش"><Input name="sortOrder" inputMode="numeric" defaultValue={reward?.sortOrder ?? 0} /></Field>
      <div className="sm:col-span-2 lg:col-span-3"><Field label="توضیح" optional><Textarea name="description" rows={2} defaultValue={reward?.description} maxLength={300} /></Field></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary,#c9a45c)]" /> فعال و قابل دریافت برای مشتریان
      </label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" variant="gold" loading={pending} data-testid="reward-save">ذخیره جایزه</Button>
        <Button type="button" variant="ghost" onClick={onDone}>انصراف</Button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------- config */

function ConfigForm({ config, tiers: initialTiers, canEdit }: { config: Config; tiers: TierDef[]; canEdit: boolean }) {
  const { run, pending } = useAct()
  const [c, setC] = useState(config)
  const [tiers, setTiers] = useState(initialTiers)
  const num = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value === '' ? 0 : Number(e.target.value) })
  const setTier = (i: number, patch: Partial<TierDef>) => setTiers(tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)))

  return (
    <form
      className="space-y-4"
      data-testid="club-config-form"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveLoyaltyConfigAction(c, tiers), { ok: 'تنظیمات باشگاه ذخیره شد' })
      }}
    >
      {!canEdit && <Alert tone="info">تغییر قوانین امتیاز فقط برای نقش مدیر فعال است.</Alert>}
      <fieldset disabled={!canEdit || pending} className="space-y-4">
        <Card title="قوانین امتیاز">
          <label className="mb-3 flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={c.enabled} onChange={(e) => setC({ ...c, enabled: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary,#c9a45c)]" /> باشگاه مشتریان فعال باشد (خاموش = امتیاز جدیدی صادر نمی‌شود)
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="امتیاز به ازای هر ۱٬۰۰۰ تومان خرید"><Input inputMode="decimal" value={c.pointsPerThousandToman} onChange={num('pointsPerThousandToman')} data-testid="cfg-per-thousand" /></Field>
            <Field label="ضریب امتیاز خدمات کلینیک" hint="۱٫۵ یعنی خدمات ۵۰٪ بیشتر امتیاز می‌دهد"><Input inputMode="decimal" value={c.serviceMultiplier} onChange={num('serviceMultiplier')} /></Field>
            <Field label="ارزش هر امتیاز (تومان)" hint="برای محاسبه بدهی باشگاه و نمایش به مشتری"><Input inputMode="numeric" value={c.pointValueToman} onChange={num('pointValueToman')} /></Field>
            {BONUS_FIELDS.map(([k, l, h]) => <Field key={k} label={`${l} (امتیاز)`} hint={h || undefined}><Input inputMode="numeric" value={Number(c[k] ?? 0)} onChange={num(k)} /></Field>)}
          </div>
        </Card>
        <Card title="سطح‌های باشگاه" actions={<Button type="button" size="sm" variant="secondary" disabled={tiers.length >= 8} onClick={() => setTiers([...tiers, { key: `TIER${tiers.length + 1}`, label: 'سطح جدید', minPoints: (tiers.at(-1)?.minPoints ?? 0) + 1000, color: '#888888', perk: '', earnMultiplier: 1 }])}>افزودن سطح</Button>}>
          <div className="space-y-3" data-testid="tiers-editor">
            {tiers.map((t, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-6">
                <Field label="کلید انگلیسی"><Input dir="ltr" value={t.key} onChange={(e) => setTier(i, { key: e.target.value.toUpperCase() })} /></Field>
                <Field label="نام"><Input value={t.label} onChange={(e) => setTier(i, { label: e.target.value })} /></Field>
                <Field label="حداقل امتیاز کل"><Input inputMode="numeric" value={t.minPoints} onChange={(e) => setTier(i, { minPoints: Number(e.target.value) || 0 })} disabled={i === 0} /></Field>
                <Field label="ضریب امتیاز"><Input inputMode="decimal" value={t.earnMultiplier} onChange={(e) => setTier(i, { earnMultiplier: Number(e.target.value) || 1 })} /></Field>
                <Field label="رنگ"><Input type="color" value={/^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : '#888888'} onChange={(e) => setTier(i, { color: e.target.value })} className="h-11 p-1" /></Field>
                <div className="flex items-end">{i > 0 && <Button type="button" variant="dangerOutline" size="sm" onClick={() => setTiers(tiers.filter((_, k) => k !== i))}>حذف سطح</Button>}</div>
                <div className="sm:col-span-2 lg:col-span-6"><Field label="مزیت این سطح (متن نمایش به مشتری)"><Input value={t.perk} onChange={(e) => setTier(i, { perk: e.target.value })} maxLength={140} /></Field></div>
              </div>
            ))}
          </div>
        </Card>
      </fieldset>
      {canEdit && <Button type="submit" variant="gold" loading={pending} data-testid="cfg-save">ذخیره تنظیمات</Button>}
    </form>
  )
}
