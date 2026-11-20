import type { ReactNode } from 'react'
import { db } from '@/lib/db'
import { Link } from '@/i18n/routing'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/admin/kit/stat-card'
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/components/admin/order-status'
import { faNum, relativeAgeFa, tehranDayStart, toman } from '@/components/admin/format'

const DAY = 24 * 60 * 60 * 1000
const PAID_STATES = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const
const OPEN_STATES = ['CONFIRMED', 'PROCESSING'] as const

export const ICONS = {
  orders: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 7h6m-6 4h4',
  box: 'm21 8-9-5-9 5m18 0-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 2 9 6 9-6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v10m3-7.5c0-1.1-1.3-2-3-2s-3 .9-3 2 1.3 2 3 2 3 .9 3 2-1.3 2-3 2-3-.9-3-2',
  send: 'm22 2-7 20-4-9-9-4zM22 2 11 13',
} as const

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

export function Panel({ title, href, hrefLabel = 'مشاهده همه', children, testId }: { title: string; href?: string; hrefLabel?: string; children: ReactNode; testId?: string }) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface-card" data-testid={testId}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-extrabold">{title}</h2>
        {href && (
          <Link href={href as never} className="shrink-0 text-xs font-bold text-primary hover:underline">
            {hrefLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="p-6 text-center text-sm text-muted-foreground">{children}</p>
}

/** A row that links to the pre-filtered list: count, label, hint. */
function StatRow({ href, label, hint, value, urgent }: { href: string; label: string; hint?: string; value: string; urgent?: boolean }) {
  return (
    <li>
      <Link href={href as never} className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm hover:bg-surface-hover">
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{label}</span>
          {hint && <span className="block text-xs leading-5 text-muted-foreground">{hint}</span>}
        </span>
        <span className={`text-lg font-black ${urgent ? 'text-primary' : ''}`}>{value}</span>
      </Link>
    </li>
  )
}

export function WidgetSkeleton({ tall }: { tall?: boolean }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl border border-border bg-surface-card ${tall ? 'h-56' : 'h-28'}`} />
}

export function WidgetError({ title }: { title: string }) {
  return (
    <Panel title={title}>
      <Empty>نمایش این بخش ممکن نشد. صفحه را دوباره باز کنید.</Empty>
    </Panel>
  )
}

/** Runs a widget body; a failing query shows a small error card instead of breaking the dashboard. */
async function guard(title: string, body: () => Promise<ReactNode>): Promise<ReactNode> {
  try {
    return await body()
  } catch (error) {
    console.error(`[dashboard] widget "${title}" failed`, error)
    return <WidgetError title={title} />
  }
}

export async function TasksWidget({ userId }: { userId: string }) {
  return guard('وظایف امروز', async () => {
    const now = new Date()
    const endOfDay = new Date(new Date().setHours(23, 59, 59, 999))
    const where = { status: { in: ['OPEN', 'IN_PROGRESS'] as ('OPEN' | 'IN_PROGRESS')[] }, dueAt: { lte: endOfDay }, OR: [{ ownerId: userId }, { ownerId: null }] }
    const [rows, total, overdue] = await Promise.all([
      db.crmTask.findMany({ where, orderBy: { dueAt: 'asc' }, take: 5, select: { id: true, title: true, dueAt: true } }),
      db.crmTask.count({ where }),
      db.crmTask.count({ where: { ...where, dueAt: { lt: new Date(tehranDayStart(now)) } } }),
    ])
    return (
      <Panel title="وظایف امروز" href="/admin/tasks?scope=today" testId="widget-tasks">
        {rows.length === 0 ? (
          <Empty>برای امروز کار باز ندارید. یک روز آرام.</Empty>
        ) : (
          <>
            <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
              {faNum(total)} وظیفه{overdue > 0 ? `، ${faNum(overdue)} مورد عقب‌افتاده` : ''}
            </p>
            <ul className="divide-y divide-border">
              {rows.map((t) => {
                const late = t.dueAt ? t.dueAt < tehranDayStart(now) : false
                return (
                  <li key={t.id}>
                    <Link href={'/admin/tasks?scope=today' as never} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-hover">
                      <span className="min-w-0 flex-1 truncate font-bold">{t.title}</span>
                      {late ? <Badge tone="danger">عقب‌افتاده</Badge> : <Badge tone="gold">امروز</Badge>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Panel>
    )
  })
}

export async function LeadsWidget() {
  return guard('سرنخ‌های جدید', async () => {
    const [rows, total] = await Promise.all([
      db.lead.findMany({ where: { stage: 'NEW' }, orderBy: { createdAt: 'asc' }, take: 5, select: { id: true, name: true, phone: true, createdAt: true } }),
      db.lead.count({ where: { stage: 'NEW' } }),
    ])
    const now = new Date()
    return (
      <Panel title="سرنخ‌های جدید" href="/admin/leads?stage=NEW" testId="widget-leads">
        {rows.length === 0 ? (
          <Empty>سرنخ تازه‌ای منتظر تماس نیست.</Empty>
        ) : (
          <>
            <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{faNum(total)} سرنخ منتظر اولین تماس، قدیمی‌ترین‌ها اول</p>
            <ul className="divide-y divide-border">
              {rows.map((l) => {
                const stale = now.getTime() - l.createdAt.getTime() > DAY
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{l.name || 'بدون نام'}</span>
                      <a href={`tel:${l.phone}`} dir="ltr" className="ltr-nums text-xs text-muted-foreground hover:text-primary">
                        {l.phone}
                      </a>
                    </span>
                    <Badge tone={stale ? 'warning' : 'gold'}>{relativeAgeFa(l.createdAt, now)}</Badge>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Panel>
    )
  })
}

export async function MessagesWidget() {
  return guard('پیام‌های باز', async () => {
    const [rows, total] = await Promise.all([
      db.contactMessage.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 5, select: { id: true, name: true, message: true, createdAt: true } }),
      db.contactMessage.count({ where: { status: 'OPEN' } }),
    ])
    const now = new Date()
    return (
      <Panel title="پیام‌های باز" href="/admin/messages?status=OPEN" testId="widget-messages">
        {rows.length === 0 ? (
          <Empty>پیام بی‌پاسخی ندارید.</Empty>
        ) : (
          <>
            <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{faNum(total)} پیام در انتظار پاسخ</p>
            <ul className="divide-y divide-border">
              {rows.map((m) => (
                <li key={m.id} className="px-4 py-2.5 text-sm">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold">{m.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relativeAgeFa(m.createdAt, now)}</span>
                  </span>
                  <span className="clamp-1 block text-xs text-muted-foreground">{m.message}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    )
  })
}

export async function OrdersActionWidget() {
  return guard('سفارش‌های نیازمند اقدام', async () => {
    const now = new Date()
    const [open, oldest, pending, flagged] = await Promise.all([
      db.order.count({ where: { status: { in: [...OPEN_STATES] } } }),
      db.order.findFirst({ where: { status: { in: [...OPEN_STATES] } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      db.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      // Notes written by the payment and stock code when a person has to step in.
      db.order.count({
        where: {
          status: { notIn: ['DELIVERED', 'CANCELLED'] },
          OR: [{ adminNote: { contains: '⚠' } }, { adminNote: { contains: 'کسری' } }, { adminNote: { contains: 'بازگشت وجه' } }],
        },
      }),
    ])
    const late = oldest ? now.getTime() - oldest.createdAt.getTime() > DAY : false
    return (
      <Panel title="سفارش‌های نیازمند اقدام" href="/admin/orders?status=open" testId="widget-orders-action">
        <ul className="divide-y divide-border">
          <StatRow
            href="/admin/orders?status=open"
            label="پرداخت‌شده و آماده ارسال"
            hint={oldest ? `قدیمی‌ترین: ${relativeAgeFa(oldest.createdAt, now)}${late ? ' (دیر شده)' : ''}` : 'سفارشی در صف آماده‌سازی نیست'}
            value={faNum(open)}
            urgent={open > 0}
          />
          <StatRow href="/admin/orders?status=PENDING_PAYMENT" label="در انتظار پرداخت" hint="پرداخت آنلاین هنوز کامل نشده است" value={faNum(pending)} />
          <StatRow href="/admin/orders?status=flagged" label="نیازمند بررسی یا بازگشت وجه" hint="یادداشت هشدار کسری موجودی یا استرداد دارند" value={faNum(flagged)} urgent={flagged > 0} />
        </ul>
      </Panel>
    )
  })
}

export async function ExpiryWidget() {
  return guard('انقضا', async () => {
    const now = new Date()
    const limit = new Date(now.getTime() + 30 * DAY)
    const base = { quantity: { gt: 0 }, product: { deletedAt: null } }
    const CAP = 500
    const [expired, critical, atRisk, undated] = await Promise.all([
      db.inventory.count({ where: { ...base, expiryDate: { lt: now } } }),
      db.inventory.count({ where: { ...base, expiryDate: { gte: now, lte: limit } } }),
      db.inventory.findMany({ where: { ...base, expiryDate: { lte: limit } }, take: CAP, select: { quantity: true, costPrice: true, product: { select: { price: true } } } }),
      db.product.count({
        where: { deletedAt: null, isActive: true, tracksExpiry: true, stockStatus: { in: ['IN_STOCK', 'LOW_STOCK'] }, inventory: { none: { quantity: { gt: 0 }, expiryDate: { gt: now } } } },
      }),
    ])
    const value = atRisk.reduce((sum, b) => sum + b.quantity * (b.costPrice ?? b.product.price), 0)
    return (
      <Panel title="انقضا" href="/admin/inventory" hrefLabel="برد موجودی" testId="widget-expiry">
        <ul className="divide-y divide-border">
          <StatRow href="/admin/inventory?state=expired" label="منقضی‌شده با موجودی" hint="باید از قفسه و فروش جمع شود" value={faNum(expired)} urgent={expired > 0} />
          <StatRow href="/admin/inventory?state=critical" label="کمتر از ۳۰ روز مانده" hint="برای تخفیف یا فروش سریع" value={faNum(critical)} urgent={critical > 0} />
          <StatRow
            href="/admin/inventory"
            label="ارزش در معرض خطر"
            hint={undated > 0 ? `${faNum(undated)} محصول فاسدشدنی بدون تاریخ` : 'منقضی‌شده‌ها و کمتر از ۳۰ روز'}
            value={`${toman(value)}${atRisk.length >= CAP ? '+' : ''}`}
          />
        </ul>
      </Panel>
    )
  })
}

export async function LowStockWidget() {
  return guard('کمبود موجودی', async () => {
    const [low, out] = await Promise.all([
      db.product.count({ where: { deletedAt: null, isActive: true, stockStatus: 'LOW_STOCK' } }),
      db.product.count({ where: { deletedAt: null, isActive: true, stockStatus: 'OUT_OF_STOCK' } }),
    ])
    return (
      <StatCard
        statKey="low-stock"
        href="/admin/products?stock=OUT_OF_STOCK"
        icon={<Icon d={ICONS.box} />}
        value={faNum(out)}
        label="محصول ناموجود"
        hint={`${faNum(low)} محصول با موجودی محدود`}
        tone={out > 0 ? 'warn' : 'neutral'}
      />
    )
  })
}

export async function CartsWidget() {
  return guard('سبدهای رهاشده ارزشمند', async () => {
    const now = Date.now()
    const rows = await db.cartSnapshot.findMany({
      where: { itemCount: { gt: 0 }, subtotal: { gte: 500_000 }, recoveredOrderId: null, updatedAt: { gte: new Date(now - 7 * DAY), lte: new Date(now - 60 * 60 * 1000) } },
      orderBy: { subtotal: 'desc' },
      take: 5,
      select: { id: true, subtotal: true, itemCount: true, updatedAt: true, customer: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    })
    return (
      <Panel title="سبدهای رهاشده ارزشمند" href="/admin/carts" testId="widget-carts">
        {rows.length === 0 ? (
          <Empty>سبد رهاشده‌ی پرارزشی در هفته‌ی اخیر نیست.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/customers/${c.customer.id}` as never} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-hover">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{[c.customer.firstName, c.customer.lastName].filter(Boolean).join(' ') || c.customer.phone}</span>
                    <span className="block text-xs text-muted-foreground">
                      {faNum(c.itemCount)} قلم · {relativeAgeFa(c.updatedAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-black">{toman(c.subtotal)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    )
  })
}

export async function OutboxWidget() {
  return guard('خطاهای صف پیامک', async () => {
    const failed = await db.messageOutbox.count({ where: { status: 'FAILED', createdAt: { gte: new Date(Date.now() - 7 * DAY) } } })
    return (
      <StatCard
        statKey="outbox-failed"
        href="/admin/outbox?status=FAILED"
        icon={<Icon d={ICONS.send} />}
        value={faNum(failed)}
        label="پیامک ناموفق"
        hint={failed > 0 ? 'در ۷ روز اخیر ارسال نشده‌اند، بررسی کنید' : 'در ۷ روز اخیر خطایی نبوده است'}
        tone={failed > 0 ? 'danger' : 'ok'}
      />
    )
  })
}

export async function SalesWidget() {
  return guard('فروش', async () => {
    const today = tehranDayStart(new Date())
    const weekAgo = new Date(today.getTime() - 6 * DAY)
    const paid = { status: { in: [...PAID_STATES] } }
    const [day, week] = await Promise.all([
      db.order.aggregate({ where: { ...paid, createdAt: { gte: today } }, _sum: { total: true }, _count: true }),
      db.order.aggregate({ where: { ...paid, createdAt: { gte: weekAgo } }, _sum: { total: true }, _count: true }),
    ])
    return (
      <StatCard
        statKey="sales"
        href="/admin/orders?status=all"
        icon={<Icon d={ICONS.coin} />}
        value={toman(day._sum.total ?? 0)}
        label={`فروش امروز (${faNum(day._count)} سفارش)`}
        hint={`۷ روز اخیر: ${toman(week._sum.total ?? 0)} در ${faNum(week._count)} سفارش`}
        tone="gold"
      />
    )
  })
}

export async function ChurnWidget() {
  return guard('مشتریان پرخطر', async () => {
    const [rows, total] = await Promise.all([
      db.customer.findMany({
        where: { churnRisk: 'HIGH', isBlocked: false },
        orderBy: [{ healthScore: 'asc' }, { lastOrderAt: 'asc' }],
        take: 5,
        select: { id: true, firstName: true, lastName: true, phone: true, healthScore: true, lastOrderAt: true },
      }),
      db.customer.count({ where: { churnRisk: 'HIGH', isBlocked: false } }),
    ])
    return (
      <Panel title="مشتریان پرخطر" href="/admin/customers?churn=HIGH" testId="widget-churn">
        {rows.length === 0 ? (
          <Empty>فعلاً مشتری پرخطری شناسایی نشده است.</Empty>
        ) : (
          <>
            <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{faNum(total)} مشتری در معرض ریزش، با تماس یا پیامک پیگیری کنید</p>
            <ul className="divide-y divide-border">
              {rows.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/customers/${c.id}` as never} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-hover">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{[c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone}</span>
                      <span className="block text-xs text-muted-foreground">{c.lastOrderAt ? `آخرین خرید ${relativeAgeFa(c.lastOrderAt)}` : 'هنوز خریدی نداشته'}</span>
                    </span>
                    {c.healthScore !== null && <Badge tone="danger">سلامت {faNum(c.healthScore)}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    )
  })
}

export async function RecentOrdersWidget() {
  return guard('آخرین سفارش‌ها', async () => {
    const now = new Date()
    const rows = await db.order.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, number: true, status: true, total: true, shipName: true, createdAt: true } })
    return (
      <Panel title="آخرین سفارش‌ها" href="/admin/orders?status=all" testId="widget-recent-orders">
        {rows.length === 0 ? (
          <Empty>هنوز سفارشی ثبت نشده است.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders?status=all&q=${encodeURIComponent(o.number)}` as never} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-surface-hover">
                  <span className="ltr-nums font-bold" dir="ltr">
                    {o.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground/85">{o.shipName}</span>
                  <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  <span className="w-full text-xs text-muted-foreground sm:w-auto">
                    {toman(o.total)} · {relativeAgeFa(o.createdAt, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    )
  })
}
