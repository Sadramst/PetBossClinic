import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

// The welcome popup (8 s after load) would cover the page during long tests: these tests are not about it.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('pb_welcome_popup_v1', String(Date.now() + 365 * 86400000))
    } catch {
      /* storage may be unavailable */
    }
  })
})

/**
 * CRM work management, end to end: tasks and follow-ups, the lead pipeline, lead to customer conversion and the
 * support inbox. Every test signs in with the HMAC session cookie and a real User row (owners, assignees and the
 * audit log point at it), drives the real admin UI and proves the effect in the database.
 *
 * Isolation: both browser projects run this file at once and sibling files share the database. All data is
 * tied to TAG (per-worker random letters) or to a tracked id and removed in afterAll by exactly those keys.
 * No assertion relies on a global count. No global singleton is touched, so the tests are parallel safe.
 */
const prisma = new PrismaClient()

// Letters only: a search term with digits would also be matched against phone numbers.
const TAG = Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')
const PHONE_PART = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
let seq = 0

const userIds = new Set<string>()
const customerIds = new Set<string>()
const customerPhones = new Set<string>()
const taskIds = new Set<string>()
const leadIds = new Set<string>()
const ticketIds = new Set<string>()

const letters = (n: number) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')
/** A unique, letters-only search token for one test. */
const token = () => `${TAG}${letters(4)}`

function uniquePhone(): string {
  const phone = `0936${PHONE_PART}${String(++seq).padStart(4, '0')}`
  customerPhones.add(phone)
  return phone
}

const DAY = 86_400_000
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY)

type Role = 'ADMIN' | 'EDITOR' | 'VIEWER'

function sessionToken(userId: string, role: Role): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production'
  const payload = { userId, email: `${userId}@example.test`, name: 'مدیر آزمون پیگیری', role, expiresAt: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
}

/** Real User row plus signed session. Pass `existing` to swap the role of the same user (cookie is replaced). */
async function signIn(context: BrowserContext, baseURL: string | undefined, role: Role, existing?: { id: string }) {
  const user =
    existing ??
    (await prisma.user.create({
      data: { email: `e2e-crmb-${TAG}-${++seq}@example.test`, name: `کارمند ${letters(5)}`, role },
    }))
  userIds.add(user.id)
  await context.addCookies([{ name: 'petboss_session', value: sessionToken(user.id, role), url: baseURL! }])
  return user
}

/** Waits until React has attached to the element: a click before that would do nothing (or submit natively). */
async function hydrated(page: Page, testid: string) {
  await page.waitForFunction(
    (id) => {
      const el = document.querySelector(`[data-testid="${id}"]`)
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps'))
    },
    testid,
    { timeout: 30000 }
  )
}

async function gotoPage(page: Page, url: string, root: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId(root)).toBeVisible()
  await hydrated(page, root)
}

/** Confirms the confirmation dialog whose text contains `title` (the drawer is a dialog too, so scope by text). */
async function confirm(page: Page, title: string, label: string) {
  const dialog = page.locator('dialog[open]').filter({ hasText: title })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

async function makeCustomer() {
  const phone = uniquePhone()
  const customer = await prisma.customer.create({ data: { phone, firstName: 'مشتری', lastName: `${TAG} ${++seq}`, marketingSmsConsent: false } as never })
  customerIds.add(customer.id)
  return customer
}

async function makeTask(over: Record<string, unknown> & { title: string }) {
  const t = await prisma.crmTask.create({ data: { type: 'FOLLOW_UP', priority: 2, ...over } as never })
  taskIds.add(t.id)
  return t
}

async function makeLead(stage: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'APPOINTMENT_BOOKED' | 'WON' | 'LOST', name: string, over: Record<string, unknown> = {}) {
  const phone = uniquePhone()
  const lead = await prisma.lead.create({
    data: { name, phone, normalizedPhone: phone, stage, status: stage === 'NEW' ? 'NEW' : 'CONTACTED', source: 'e2e', serviceInterest: 'واکسیناسیون', ...over } as never,
  })
  leadIds.add(lead.id)
  return lead
}

async function makeTicket(subject: string, over: Record<string, unknown> = {}) {
  const phone = uniquePhone()
  const m = await prisma.contactMessage.create({
    data: { name: `مراجع ${letters(4)}`, phone, normalizedPhone: phone, subject, message: 'سلام، می‌خواستم دربارهٔ زمان واکسن گربه‌ام بپرسم.', ...over } as never,
  })
  ticketIds.add(m.id)
  return m
}

/**
 * Task rows are paged (25) and sorted by due date, and sibling data may share the lists: scan the pages of a
 * scope until the title shows up. Returns whether it was found.
 */
async function taskInScope(page: Page, scope: string, title: string, extra = ''): Promise<boolean> {
  for (let p = 1; p <= 8; p++) {
    await page.goto(`/admin/tasks?scope=${scope}${extra}&page=${p}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('tasks-page')).toBeVisible()
    if ((await page.getByTestId('task-row').filter({ hasText: title }).count()) > 0) return true
    if ((await page.getByTestId('task-row').count()) < 25) return false
  }
  return false
}

const taskRow = (page: Page, title: string) => page.getByTestId('task-row').filter({ hasText: title })

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'page must not scroll sideways').toBeLessThanOrEqual(1)
}

test.describe('CRM: tasks, pipeline and support inbox', () => {
  // Each test is its own staff user on its own client address: CRM writes are rate limited per address and user.
  test.beforeEach(async ({ context }) => {
    const o = () => Math.floor(Math.random() * 250) + 1
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${o()}.${o()}.${o()}` })
  })

  test.skip(!process.env.DATABASE_URL, 'needs the local database')

  test.afterAll(async () => {
    const guarded = async (fn: () => Promise<unknown>) => {
      try {
        await fn()
      } catch {
        /* a sibling table may not cascade: the next step still runs */
      }
    }
    const customers = await prisma.customer.findMany({
      where: { OR: [{ phone: { in: [...customerPhones] } }, { id: { in: [...customerIds] } }, { lastName: { contains: TAG } }] },
      select: { id: true, contactId: true, phone: true },
    })
    const cIds = customers.map((c) => c.id)
    const contactIds = customers.map((c) => c.contactId).filter((x): x is string => !!x)
    const leads = await prisma.lead.findMany({ where: { OR: [{ id: { in: [...leadIds] } }, { name: { contains: TAG } }] }, select: { id: true, contactId: true } })
    const lIds = leads.map((l) => l.id)
    const tasks = await prisma.crmTask.findMany({ where: { OR: [{ id: { in: [...taskIds] } }, { title: { contains: TAG } }] }, select: { id: true } })
    const tIds = tasks.map((t) => t.id)
    const tickets = await prisma.contactMessage.findMany({ where: { OR: [{ id: { in: [...ticketIds] } }, { subject: { contains: TAG } }] }, select: { id: true } })
    const mIds = tickets.map((m) => m.id)

    await guarded(() => prisma.crmActivity.deleteMany({ where: { OR: [{ customerId: { in: cIds } }, { refId: { in: [...tIds, ...mIds, ...lIds] } }, ...lIds.map((id) => ({ refId: { startsWith: id } })), ...mIds.map((id) => ({ refId: { startsWith: id } }))] } }))
    await guarded(() => prisma.ticketReply.deleteMany({ where: { messageId: { in: mIds } } }))
    await guarded(() => prisma.contactMessage.deleteMany({ where: { id: { in: mIds } } }))
    await guarded(() => prisma.crmTask.deleteMany({ where: { OR: [{ id: { in: tIds } }, { leadId: { in: lIds } }, { customerId: { in: cIds } }] } }))
    await guarded(() => prisma.lead.deleteMany({ where: { id: { in: lIds } } }))
    await guarded(() => prisma.messageOutbox.deleteMany({ where: { OR: [{ customerId: { in: cIds } }, { phone: { in: [...customerPhones] } }] } }))
    await guarded(() => prisma.marketingContact.deleteMany({ where: { phone: { in: [...customerPhones] } } }))
    await guarded(() => prisma.pointsTransaction.deleteMany({ where: { customerId: { in: cIds } } }))
    await guarded(() => prisma.customer.deleteMany({ where: { id: { in: cIds } } }))
    await guarded(() => prisma.contact.deleteMany({ where: { OR: [{ id: { in: contactIds } }, { phone: { in: [...customerPhones] } }] } }))
    await guarded(() => prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: [...userIds] } }, { entityId: { in: tIds } }] } }))
    await guarded(() => prisma.user.deleteMany({ where: { id: { in: [...userIds] } } }))
    await prisma.$disconnect()
  })

  test('B01 an editor creates a follow-up task from the task page and finds it under «کارهای من»', async ({ page, context, baseURL }) => {
    const me = await signIn(context, baseURL, 'EDITOR')
    const title = `تماس پیگیری ${token()}`

    await gotoPage(page, '/admin/tasks', 'tasks-page')
    await page.getByTestId('task-new').click()
    const form = page.getByTestId('task-form')
    await expect(form).toBeVisible()
    // The submit stays disabled until a title is typed
    await expect(page.getByTestId('task-form-submit')).toBeDisabled()
    await page.getByTestId('task-form-title').fill(title)
    await page.getByTestId('task-form-type').selectOption('CALL')
    await page.getByTestId('task-form-submit').click()

    // The new task is owned by the creator, due tomorrow by default, and is not a system task
    await expect
      .poll(async () => (await prisma.crmTask.findFirst({ where: { title } }))?.ownerId ?? null, { timeout: 15000 })
      .toBe(me.id)
    const row = await prisma.crmTask.findFirstOrThrow({ where: { title } })
    taskIds.add(row.id)
    expect(row.type).toBe('CALL')
    expect(row.status).toBe('OPEN')
    expect(row.system).toBe(false)
    expect(row.dueAt).not.toBeNull()
    expect(row.dueAt!.getTime()).toBeGreaterThan(Date.now())

    await expect(form).toBeHidden()
    expect(await taskInScope(page, 'mine', title)).toBe(true)
    const shown = taskRow(page, title).first()
    await expect(shown).toContainText('تماس')
    await expect(shown).toContainText('فردا')
    await noHorizontalOverflow(page)
  })

  test('B02 a customer\'s open task is counted on the 360 page and links to the task list with the customer', async ({ page, context, baseURL }) => {
    const me = await signIn(context, baseURL, 'EDITOR')
    const customer = await makeCustomer()
    const title = `یادآوری واکسن ${token()}`
    await makeTask({ title, customerId: customer.id, ownerId: me.id, dueAt: daysFromNow(2), type: 'VACCINE_REMINDER' })

    await gotoPage(page, `/admin/customers/${customer.id}`, 'customer-360')
    const card = page.getByTestId('customer-health-card')
    await expect(card).toBeVisible()
    const openTasks = page.getByTestId('health-open-tasks')
    await expect(openTasks).toContainText('کارهای باز')
    await expect(openTasks).toContainText('۱')

    await openTasks.click()
    await expect(page).toHaveURL(/\/admin\/tasks\?scope=all/)
    await expect(page.getByTestId('tasks-page')).toBeVisible()
    expect(await taskInScope(page, 'all', title)).toBe(true)
    const row = taskRow(page, title).first()
    await expect(row).toContainText('یادآوری واکسن')
    const link = row.locator(`a[href="/admin/customers/${customer.id}"]`)
    await expect(link).toContainText('مشتری')
    await link.click()
    await expect(page).toHaveURL(new RegExp(`/admin/customers/${customer.id}`))
    await expect(page.getByTestId('customer-360')).toBeVisible()
  })

  test('B03 overdue, due-today and future tasks land in the right scope', async ({ page, context, baseURL }) => {
    const me = await signIn(context, baseURL, 'EDITOR')
    const tk = token()
    const late = `عقب‌افتاده ${tk}`
    const today = `امروزی ${tk}`
    const later = `هفتهٔ بعد ${tk}`
    await makeTask({ title: late, ownerId: me.id, dueAt: daysFromNow(-3), priority: 1 })
    await makeTask({ title: today, ownerId: me.id, dueAt: new Date() })
    await makeTask({ title: later, ownerId: me.id, dueAt: daysFromNow(7) })

    // Overdue: only the late one, flagged with its age
    expect(await taskInScope(page, 'overdue', late)).toBe(true)
    await expect(taskRow(page, late).first()).toContainText('۳ روز گذشته')
    expect(await taskInScope(page, 'overdue', today)).toBe(false)
    expect(await taskInScope(page, 'overdue', later)).toBe(false)

    // Today: only the one due now
    expect(await taskInScope(page, 'today', today)).toBe(true)
    await expect(taskRow(page, today).first()).toContainText('امروز')
    expect(await taskInScope(page, 'today', late)).toBe(false)
    expect(await taskInScope(page, 'today', later)).toBe(false)

    // «کارهای من» shows all three active tasks; the scope tabs are real navigation
    expect(await taskInScope(page, 'mine', later)).toBe(true)
    await page.goto('/admin/tasks', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('tasks-scope-mine')).toBeVisible()
    await page.getByTestId('tasks-scope-overdue').click()
    await expect(page).toHaveURL(/scope=overdue/)
    await noHorizontalOverflow(page)
  })

  test('B04 completing a task closes it, drops it from «کارهای من» and writes it into the customer timeline', async ({ page, context, baseURL }) => {
    const me = await signIn(context, baseURL, 'EDITOR')
    const customer = await makeCustomer()
    const title = `ارسال نتیجهٔ آزمایش ${token()}`
    const task = await makeTask({ title, ownerId: me.id, customerId: customer.id, dueAt: daysFromNow(-1) })

    expect(await taskInScope(page, 'mine', title)).toBe(true)
    await hydrated(page, 'tasks-page')
    await taskRow(page, title).first().getByTestId('task-complete').click()

    await expect.poll(async () => (await prisma.crmTask.findUnique({ where: { id: task.id } }))?.status, { timeout: 15000 }).toBe('DONE')
    const done = await prisma.crmTask.findUniqueOrThrow({ where: { id: task.id } })
    expect(done.completedAt).not.toBeNull()
    await expect
      .poll(() => prisma.crmActivity.count({ where: { type: 'TASK_COMPLETED', refId: task.id, customerId: customer.id } }), { timeout: 15000 })
      .toBe(1)

    // Gone from the active list, present under the «انجام‌شده» filter with the strike-through row (button disabled)
    expect(await taskInScope(page, 'mine', title)).toBe(false)
    expect(await taskInScope(page, 'mine', title, '&status=DONE')).toBe(true)
    await expect(taskRow(page, title).first().getByTestId('task-complete')).toBeDisabled()

    // The customer's unified timeline now carries it
    await gotoPage(page, `/admin/customers/${customer.id}`, 'customer-360')
    await expect(page.getByTestId('timeline-item').filter({ hasText: title }).first()).toBeVisible()
  })

  test('B05 task permissions: a viewer is sent to login, an editor cannot delete, an admin deletes with a confirmation and an audit row', async ({ page, context, baseURL }) => {
    const user = await signIn(context, baseURL, 'VIEWER')
    const title = `کار حذفی ${token()}`
    const task = await makeTask({ title, ownerId: user.id, dueAt: daysFromNow(1) })

    // Viewer: the task area needs EDITOR
    await page.goto('/admin/tasks', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin(\/login)?\/?(\?.*)?$/)

    // Editor: sees the list but no delete or export controls
    await signIn(context, baseURL, 'EDITOR', user)
    expect(await taskInScope(page, 'mine', title)).toBe(true)
    await expect(taskRow(page, title).first()).toBeVisible()
    await expect(page.getByTestId('task-delete')).toHaveCount(0)
    await expect(page.getByTestId('tasks-export')).toHaveCount(0)

    // Admin: delete asks first (cancel keeps it), then removes it and logs it
    await signIn(context, baseURL, 'ADMIN', user)
    expect(await taskInScope(page, 'mine', title)).toBe(true)
    await hydrated(page, 'tasks-page')
    await taskRow(page, title).first().getByTestId('task-delete').click()
    const dialog = page.locator('dialog[open]').filter({ hasText: 'کار حذف شود؟' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'انصراف', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(await prisma.crmTask.count({ where: { id: task.id } })).toBe(1)

    await taskRow(page, title).first().getByTestId('task-delete').click()
    await confirm(page, 'کار حذف شود؟', 'حذف')
    await expect.poll(() => prisma.crmTask.count({ where: { id: task.id } }), { timeout: 15000 }).toBe(0)
    await expect
      .poll(() => prisma.auditLog.count({ where: { entity: 'CRM_TASK', action: 'DELETE', entityId: task.id } }), { timeout: 15000 })
      .toBe(1)
  })

  test('B06 a lead moves along the pipeline on the board, and only legal next stages are offered', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL, 'EDITOR')
    const tk = token()
    const lead = await makeLead('NEW', `سرنخ ${tk}`)
    const url = `/admin/leads?q=${tk}`
    const stageOf = async () => (await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage

    await gotoPage(page, url, 'leads-page')
    const card = page.getByTestId('leads-col-NEW').getByTestId('lead-card').filter({ hasText: tk })
    await expect(card).toHaveCount(1)
    // NEW can reach contacted, qualified or lost, never an appointment directly
    const options = await card.getByTestId('lead-card-move').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))
    expect(options).toEqual(['', 'CONTACTED', 'QUALIFIED', 'LOST'])

    await card.getByTestId('lead-card-move').selectOption('CONTACTED')
    await expect.poll(stageOf, { timeout: 15000 }).toBe('CONTACTED')
    await expect
      .poll(() => prisma.crmActivity.count({ where: { type: 'LEAD_STAGE_CHANGED', refId: { startsWith: lead.id } } }), { timeout: 15000 })
      .toBe(1)

    for (const [from, to] of [
      ['CONTACTED', 'QUALIFIED'],
      ['QUALIFIED', 'APPOINTMENT_BOOKED'],
    ] as const) {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('leads-page')).toBeVisible()
      await hydrated(page, 'leads-page')
      const c = page.getByTestId(`leads-col-${from}`).getByTestId('lead-card').filter({ hasText: tk })
      await expect(c).toHaveCount(1)
      await c.getByTestId('lead-card-move').selectOption(to)
      await expect.poll(stageOf, { timeout: 15000 }).toBe(to)
    }

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('leads-col-APPOINTMENT_BOOKED').getByTestId('lead-card').filter({ hasText: tk })).toHaveCount(1)
    await expect(page.getByTestId('leads-col-NEW').getByTestId('lead-card').filter({ hasText: tk })).toHaveCount(0)
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).stageChangedAt).not.toBeNull()
    await noHorizontalOverflow(page)
  })

  test('B07 losing a lead needs a reason, a lost lead can be reopened, and a viewer cannot move leads', async ({ page, context, baseURL }) => {
    const user = await signIn(context, baseURL, 'EDITOR')
    const tk = token()
    const lead = await makeLead('QUALIFIED', `سرنخ ${tk}`)
    const stageOf = async () => (await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage

    await gotoPage(page, `/admin/leads?q=${tk}`, 'leads-page')
    await page.getByTestId('leads-col-QUALIFIED').getByTestId('lead-card').filter({ hasText: tk }).getByTestId('lead-card-open').click()
    const drawer = page.getByTestId('lead-drawer')
    await expect(drawer).toBeVisible()

    // LOST asks for a reason first; the confirm button stays disabled until one is chosen
    await drawer.getByTestId('lead-move-LOST').click()
    await expect(page.getByTestId('lost-reason-panel')).toBeVisible()
    await expect(page.getByTestId('lost-reason-confirm')).toBeDisabled()
    expect(await stageOf()).toBe('QUALIFIED')
    await page.getByTestId('lost-reason-select').selectOption('PRICE')
    await expect(page.getByTestId('lost-reason-confirm')).toBeEnabled()
    await page.getByTestId('lost-reason-confirm').click()
    await expect.poll(stageOf, { timeout: 15000 }).toBe('LOST')
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).lostReason).toBe('PRICE')

    // Reopen: a lost lead can only go back to «جدید», and the reason is cleared
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('leads-page')).toBeVisible()
    await hydrated(page, 'leads-page')
    await page.getByTestId('leads-col-LOST').getByTestId('lead-card').filter({ hasText: tk }).getByTestId('lead-card-open').click()
    const d2 = page.getByTestId('lead-drawer')
    await expect(d2).toContainText('قیمت')
    await expect(d2.locator('[data-testid^="lead-move-"]')).toHaveCount(1)
    await d2.getByTestId('lead-move-NEW').click()
    await expect.poll(stageOf, { timeout: 15000 }).toBe('NEW')
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).lostReason).toBeNull()

    // A viewer sees the lead but is offered no moves
    await signIn(context, baseURL, 'VIEWER', user)
    await gotoPage(page, `/admin/leads?q=${tk}`, 'leads-page')
    await expect(page.getByTestId('lead-card').filter({ hasText: tk })).toHaveCount(1)
    await expect(page.getByTestId('lead-card-move')).toHaveCount(0)
    await page.getByTestId('lead-card').filter({ hasText: tk }).getByTestId('lead-card-open').click()
    await expect(page.getByTestId('lead-drawer')).toBeVisible()
    await expect(page.locator('[data-testid^="lead-move-"]')).toHaveCount(0)
    expect(await stageOf()).toBe('NEW')
  })

  test('B08 an appointment lead is converted to a customer: customer created, lead won, timeline written', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL, 'EDITOR')
    const tk = token()
    const lead = await makeLead('APPOINTMENT_BOOKED', `سرنخ ${tk} نوبت`, { message: 'برای واکسن سگ نوبت گرفتم' })
    expect(await prisma.customer.count({ where: { phone: lead.phone } })).toBe(0)

    await gotoPage(page, `/admin/leads?q=${tk}`, 'leads-page')
    await page.getByTestId('leads-col-APPOINTMENT_BOOKED').getByTestId('lead-card').filter({ hasText: tk }).getByTestId('lead-card-open').click()
    await expect(page.getByTestId('lead-drawer')).toBeVisible()
    await expect(page.getByTestId('lead-open-customer')).toHaveCount(0)
    await page.getByTestId('lead-convert').click()
    await confirm(page, 'این سرنخ به مشتری تبدیل شود؟', 'تبدیل')

    await expect.poll(() => prisma.customer.findUnique({ where: { phone: lead.phone } }).then((c) => c?.id ?? null), { timeout: 20000 }).not.toBeNull()
    const customer = await prisma.customer.findUniqueOrThrow({ where: { phone: lead.phone } })
    customerIds.add(customer.id)
    await expect
      .poll(async () => {
        const l = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
        return `${l.stage}:${l.customerId === customer.id}`
      }, { timeout: 20000 })
      .toBe('WON:true')
    await expect
      .poll(() => prisma.crmActivity.count({ where: { type: 'LEAD_PROMOTED', refId: lead.id, customerId: customer.id } }), { timeout: 15000 })
      .toBe(1)

    // The drawer now links to the new customer, whose 360 page shows the promotion in the timeline
    const link = page.getByTestId('lead-open-customer')
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(new RegExp(`/admin/customers/${customer.id}`))
    await expect(page.getByTestId('customer-360')).toBeVisible()
    await expect(page.getByTestId('timeline-item').filter({ hasText: 'سرنخ' }).first()).toBeVisible()

    // WON is terminal on the board for an editor
    await page.goto(`/admin/leads?q=${tk}`, { waitUntil: 'domcontentloaded' })
    const won = page.getByTestId('leads-col-WON').getByTestId('lead-card').filter({ hasText: tk })
    await expect(won).toHaveCount(1)
    await expect(won.getByTestId('lead-card-move')).toHaveCount(0)
  })

  test('B09 replying to a support ticket stops the SLA clock, keeps internal notes private and walks the status to closed', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL, 'EDITOR')
    const tk = token()
    const subject = `پرسش ${tk} واکسن`
    const ticket = await makeTicket(subject)
    const read = () => prisma.contactMessage.findUniqueOrThrow({ where: { id: ticket.id } })

    await gotoPage(page, `/admin/messages?q=${tk}`, 'inbox-page')
    await page.getByText(subject).and(page.locator(':visible')).first().click()
    const drawer = page.getByTestId('ticket-drawer')
    await expect(drawer).toBeVisible()
    await expect(page.getByTestId('ticket-sla')).toBeVisible()
    await expect(page.getByTestId('ticket-status')).toHaveValue('OPEN')
    await expect.poll(async () => (await read()).isRead, { timeout: 15000 }).toBe(true)

    // Public reply: recorded, first-response time set, the ticket now waits on the customer
    const reply = `سلام، واکسن گربه در ماه آینده انجام می‌شود ${letters(4)}`
    await page.getByTestId('ticket-reply-body').fill(reply)
    await page.getByTestId('ticket-reply-submit').click()
    await expect.poll(async () => (await read()).status, { timeout: 15000 }).toBe('PENDING')
    const afterReply = await read()
    expect(afterReply.firstResponseAt).not.toBeNull()
    const saved = await prisma.ticketReply.findFirstOrThrow({ where: { messageId: ticket.id, body: reply } })
    expect(saved.internal).toBe(false)
    await expect(page.getByTestId('ticket-reply').filter({ hasText: reply })).toBeVisible()
    await expect(page.getByTestId('ticket-status')).toHaveValue('PENDING')

    // Internal note: stored as internal, does not change the status
    await page.getByTestId('ticket-mode-internal').click()
    const note = `یادداشت داخلی ${letters(5)}`
    await page.getByTestId('ticket-reply-body').fill(note)
    await page.getByTestId('ticket-reply-submit').click()
    await expect.poll(() => prisma.ticketReply.count({ where: { messageId: ticket.id, internal: true, body: note } }), { timeout: 15000 }).toBe(1)
    expect((await read()).status).toBe('PENDING')
    await expect(page.getByTestId('ticket-reply')).toHaveCount(2)

    // Status walk: resolved, then closed (the reply form disappears on a closed ticket)
    await page.getByTestId('ticket-status').selectOption('RESOLVED')
    await expect.poll(async () => (await read()).status, { timeout: 15000 }).toBe('RESOLVED')
    expect((await read()).resolvedAt).not.toBeNull()
    await expect(page.getByTestId('ticket-reply-form')).toBeVisible()
    await page.getByTestId('ticket-status').selectOption('CLOSED')
    await expect.poll(async () => (await read()).status, { timeout: 15000 }).toBe('CLOSED')
    await expect(page.getByTestId('ticket-reply-form')).toHaveCount(0)
    await expect
      .poll(() => prisma.crmActivity.count({ where: { type: 'TICKET_STATUS_CHANGED', refId: { startsWith: ticket.id } } }), { timeout: 15000 })
      .toBeGreaterThanOrEqual(2)
  })

  test('B10 a ticket is assigned and prioritised, shows under the assignee filter, and a viewer is turned away', async ({ page, context, baseURL }) => {
    const admin = await signIn(context, baseURL, 'ADMIN')
    const assignee = await prisma.user.create({ data: { email: `e2e-crmb-${TAG}-${++seq}@example.test`, name: `مسئول ${letters(5)}`, role: 'EDITOR' } })
    userIds.add(assignee.id)
    const tk = token()
    const subject = `شکایت ${tk} ارسال`
    const ticket = await makeTicket(subject)
    const read = () => prisma.contactMessage.findUniqueOrThrow({ where: { id: ticket.id } })

    await gotoPage(page, `/admin/messages?id=${ticket.id}`, 'inbox-page')
    await expect(page.getByTestId('ticket-drawer')).toBeVisible()
    await expect(page.getByTestId('ticket-assignee')).toHaveValue('')
    await page.getByTestId('ticket-assignee').selectOption(assignee.id)
    await expect.poll(async () => (await read()).assigneeId, { timeout: 15000 }).toBe(assignee.id)
    await page.getByTestId('ticket-priority').selectOption('HIGH')
    await expect.poll(async () => (await read()).priority, { timeout: 15000 }).toBe('HIGH')

    // The inbox filters by assignee: present for the assignee, absent for «بدون مسئول»
    await page.goto(`/admin/messages?q=${tk}&assignee=${assignee.id}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('inbox-page')).toBeVisible()
    await expect(page.getByText(subject).and(page.locator(':visible')).first()).toBeVisible()
    await page.goto(`/admin/messages?q=${tk}&assignee=none`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('inbox-page')).toBeVisible()
    await expect(page.getByText(subject)).toHaveCount(0)

    // Un-assign puts it back among the unassigned
    await gotoPage(page, `/admin/messages?id=${ticket.id}`, 'inbox-page')
    await page.getByTestId('ticket-assignee').selectOption('')
    await expect.poll(async () => (await read()).assigneeId, { timeout: 15000 }).toBeNull()

    // Tickets carry customer PII: a viewer is turned away and the page does not mark the ticket read
    await prisma.contactMessage.update({ where: { id: ticket.id }, data: { isRead: false } })
    await signIn(context, baseURL, 'VIEWER', admin)
    await page.goto(`/admin/messages?id=${ticket.id}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('inbox-page')).toHaveCount(0)
    await expect(page.getByTestId('ticket-thread')).toHaveCount(0)
    expect((await read()).isRead).toBe(false)
    expect((await read()).priority).toBe('HIGH')
  })
})
