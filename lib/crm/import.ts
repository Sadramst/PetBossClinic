import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { CrmError } from '@/lib/crm/errors'
import { newId } from '@/lib/crm/types'
import { normalizeMobile } from '@/lib/text/iran'
import { normalizeFa } from '@/lib/text/persian'
import { canonicalEmail } from '@/lib/customer/email'
import { parseJalaliInput, toLatinDigits } from '@/lib/date/jalali'

export const MAX_IMPORT_ROWS = 5000

export type ImportRow = { phone: string; name?: string; email?: string; city?: string; birthDate?: string; tags?: string[]; notes?: string }
export type ImportError = { line: number; message: string }
export type PreviewRow = { index: number; phone: string; name: string | null; status: 'NEW' | 'DUPLICATE'; existingCustomerId?: string; emailDropped?: boolean }

/** Accepted header spellings (English and the Persian ones people use in spreadsheets). */
const HEADERS: Record<string, keyof ImportRow> = {
  phone: 'phone', mobile: 'phone', tel: 'phone', 'موبایل': 'phone', 'شماره': 'phone', 'تلفن': 'phone', 'شماره موبایل': 'phone',
  name: 'name', fullname: 'name', 'نام': 'name', 'نام و نام خانوادگی': 'name',
  email: 'email', 'ایمیل': 'email',
  city: 'city', 'شهر': 'city',
  birthdate: 'birthDate', birthday: 'birthDate', 'تاریخ تولد': 'birthDate', 'تولد': 'birthDate',
  tags: 'tags', 'برچسب': 'tags', 'برچسب‌ها': 'tags',
  notes: 'notes', note: 'notes', 'یادداشت': 'notes', 'توضیحات': 'notes',
}

/** RFC-4180 style CSV: quotes, doubled quotes and line breaks inside quotes. Delimiter is sniffed from the header line. */
export function parseCsvRecords(input: string): Array<{ line: number; cells: string[] }> {
  const text = input.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = [',', ';', '\t'].map((d) => ({ d, n: firstLine.split(d).length })).sort((a, b) => b.n - a.n)[0].d
  const out: Array<{ line: number; cells: string[] }> = []
  let cells: string[] = []
  let cur = ''
  let inQ = false
  let line = 1
  let recordLine = 1
  const endCell = () => {
    cells.push(cur)
    cur = ''
  }
  const endRecord = () => {
    endCell()
    if (!(cells.length === 1 && cells[0].trim() === '')) out.push({ line: recordLine, cells })
    cells = []
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else {
        if (ch === '\n') line++
        cur += ch
      }
    } else if (ch === '"' && cur === '') inQ = true
    else if (ch === delim) endCell()
    else if (ch === '\r') {
      /* swallowed: \n ends the record */
    } else if (ch === '\n') {
      endRecord()
      line++
      recordLine = line
    } else cur += ch
  }
  if (cur !== '' || cells.length > 0) endRecord()
  return out
}

const clean = (v: string | undefined, max: number) => (v === undefined ? '' : normalizeFa(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max))

/** Birth date as written by people: Jalali (1375/04/09, Persian digits fine) or ISO (1996-06-30). Returns ISO date or null. */
export function parseBirthDate(raw: string, now: Date = new Date()): string | null {
  const s = toLatinDigits(raw.trim())
  let d: Date | null = null
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso && Number(iso[1]) > 1700) {
    d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    if (d.getUTCMonth() !== Number(iso[2]) - 1) d = null
  } else d = parseJalaliInput(s)
  if (!d || Number.isNaN(d.getTime())) return null
  if (d.getTime() > now.getTime()) return null
  if (now.getUTCFullYear() - d.getUTCFullYear() > 110) return null
  return d.toISOString().slice(0, 10)
}

/** Validates one raw row. Returns the cleaned row or a Persian reason. */
export function validateImportRow(raw: Partial<Record<keyof ImportRow, string | string[]>>, now: Date = new Date()): { row?: ImportRow; error?: string } {
  const phoneRaw = typeof raw.phone === 'string' ? raw.phone : ''
  if (!phoneRaw.trim()) return { error: 'شمارهٔ موبایل خالی است.' }
  const phone = normalizeMobile(phoneRaw)
  if (!phone) return { error: 'شمارهٔ موبایل معتبر نیست (نمونه: ۰۹۱۲۱۲۳۴۵۶۷).' }
  const row: ImportRow = { phone }
  const name = clean(raw.name as string | undefined, 80)
  if (name) row.name = name
  const emailRaw = clean(raw.email as string | undefined, 120)
  if (emailRaw) {
    const e = canonicalEmail(emailRaw)
    if (!e) return { error: 'ایمیل معتبر نیست.' }
    row.email = e
  }
  const city = clean(raw.city as string | undefined, 40)
  if (city) row.city = city
  const bd = clean(raw.birthDate as string | undefined, 20)
  if (bd) {
    const iso = parseBirthDate(bd, now)
    if (!iso) return { error: 'تاریخ تولد معتبر نیست (نمونه: ۱۳۷۵/۰۴/۰۹).' }
    row.birthDate = iso
  }
  const tagsRaw = Array.isArray(raw.tags) ? raw.tags.join('|') : clean(raw.tags as string | undefined, 300)
  const tags = [...new Set(tagsRaw.split(/[|،;,]/).map((t) => clean(t, 30)).filter(Boolean))].slice(0, 10)
  if (tags.length) row.tags = tags
  const notes = clean(raw.notes as string | undefined, 2000)
  if (notes) row.notes = notes
  return { row }
}

export function parseImportCsv(text: string, now: Date = new Date()): { rows: ImportRow[]; errors: ImportError[] } {
  const records = parseCsvRecords(text ?? '')
  const errors: ImportError[] = []
  const rows: ImportRow[] = []
  if (records.length === 0) return { rows, errors: [{ line: 1, message: 'فایل خالی است.' }] }
  const header = records[0].cells.map((h) => {
    const n = clean(h, 40).toLowerCase()
    return HEADERS[n] ?? HEADERS[n.replace(/[\s_-]+/g, '')] ?? null
  })
  if (!header.includes('phone')) return { rows, errors: [{ line: records[0].line, message: 'ستون «phone» (موبایل) در سطر اول پیدا نشد.' }] }
  if (records.length - 1 > MAX_IMPORT_ROWS) return { rows, errors: [{ line: 1, message: `هر فایل حداکثر ${MAX_IMPORT_ROWS} ردیف می‌تواند داشته باشد.` }] }
  const seen = new Set<string>()
  for (const rec of records.slice(1)) {
    const raw: Partial<Record<keyof ImportRow, string>> = {}
    header.forEach((k, i) => {
      if (k && rec.cells[i] !== undefined) raw[k] = rec.cells[i]
    })
    const v = validateImportRow(raw, now)
    if (!v.row) {
      errors.push({ line: rec.line, message: v.error ?? 'ردیف معتبر نیست.' })
      continue
    }
    if (seen.has(v.row.phone)) {
      errors.push({ line: rec.line, message: 'این شماره در همین فایل تکراری است.' })
      continue
    }
    seen.add(v.row.phone)
    rows.push(v.row)
  }
  return { rows, errors }
}

const chunks = <T>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

function revalidate(rows: ImportRow[]): { valid: ImportRow[]; invalid: number } {
  const valid: ImportRow[] = []
  const seen = new Set<string>()
  let invalid = 0
  for (const r of rows.slice(0, MAX_IMPORT_ROWS)) {
    const v = validateImportRow({ ...r, tags: r.tags })
    if (!v.row || seen.has(v.row.phone)) {
      invalid++
      continue
    }
    seen.add(v.row.phone)
    valid.push(v.row)
  }
  return { valid, invalid: invalid + Math.max(0, rows.length - MAX_IMPORT_ROWS) }
}

export async function previewImport(rows: ImportRow[]): Promise<{ valid: number; duplicates: number; invalid: number; rows: PreviewRow[] }> {
  const { valid, invalid } = revalidate(rows)
  const existing = new Map<string, string>()
  const emailTaken = new Set<string>()
  for (const part of chunks(valid, 1000)) {
    const found = await db.customer.findMany({ where: { phone: { in: part.map((r) => r.phone) } }, select: { id: true, phone: true } })
    for (const f of found) existing.set(f.phone, f.id)
    const emails = part.map((r) => r.email).filter((e): e is string => !!e)
    if (emails.length) for (const e of await db.customer.findMany({ where: { email: { in: emails } }, select: { email: true } })) emailTaken.add(e.email!)
  }
  const out: PreviewRow[] = valid.map((r, index) => ({
    index,
    phone: r.phone,
    name: r.name ?? null,
    status: existing.has(r.phone) ? 'DUPLICATE' : 'NEW',
    existingCustomerId: existing.get(r.phone),
    emailDropped: !!r.email && emailTaken.has(r.email) && !existing.has(r.phone) ? true : undefined,
  }))
  const duplicates = out.filter((r) => r.status === 'DUPLICATE').length
  return { valid: out.length - duplicates, duplicates, invalid, rows: out }
}

/**
 * Creates the customers that do not exist yet (by phone). Imported customers have no marketing consent,
 * get no welcome points or SMS, and carry source IMPORT. Safe to run twice: existing phones are skipped.
 */
export async function commitImport(rows: ImportRow[], adminId: string): Promise<{ created: number; skipped: number }> {
  if (rows.length > MAX_IMPORT_ROWS) throw new CrmError('TOO_MANY', `هر فایل حداکثر ${MAX_IMPORT_ROWS} ردیف می‌تواند داشته باشد.`)
  const { valid, invalid } = revalidate(rows)
  let created = 0
  const createdPhones: string[] = []
  for (const part of chunks(valid, 500)) {
    const existing = new Set((await db.customer.findMany({ where: { phone: { in: part.map((r) => r.phone) } }, select: { phone: true } })).map((c) => c.phone))
    const emails = part.map((r) => r.email).filter((e): e is string => !!e)
    const taken = new Set(emails.length ? (await db.customer.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((c) => c.email!) : [])
    const fresh = part.filter((r) => !existing.has(r.phone))
    const seenEmail = new Set<string>()
    const data: Prisma.CustomerCreateManyInput[] = fresh.map((r) => {
      const [firstName, ...rest] = (r.name ?? '').split(/\s+/).filter(Boolean)
      const email = r.email && !taken.has(r.email) && !seenEmail.has(r.email) ? r.email : null
      if (email) seenEmail.add(email)
      return {
        id: newId(),
        phone: r.phone,
        firstName: firstName ?? null,
        lastName: rest.join(' ') || null,
        email,
        city: r.city ?? null,
        birthDate: r.birthDate ? new Date(`${r.birthDate}T00:00:00.000Z`) : null,
        tags: r.tags ?? [],
        notes: r.notes ?? null,
        source: 'IMPORT',
        createdByAdmin: true,
        marketingSmsConsent: false,
      }
    })
    if (data.length === 0) continue
    // skipDuplicates: a parallel import of the same phone can only create it once.
    const res = await db.customer.createMany({ data, skipDuplicates: true })
    created += res.count
    createdPhones.push(...data.map((d) => d.phone))
  }
  if (createdPhones.length) await afterImport(createdPhones, adminId)
  return { created, skipped: valid.length - created + invalid }
}

/** Referral code, contact link and a timeline entry for the new customers (batched, best effort). */
async function afterImport(phones: string[], adminId: string): Promise<void> {
  const { onCustomerCreated } = await import('@/lib/club/hooks')
  for (const part of chunks(phones, 500)) {
    const customers = await db.customer.findMany({ where: { phone: { in: part }, source: 'IMPORT' }, select: { id: true, contactId: true } })
    for (const batch of chunks(customers, 10)) await Promise.all(batch.map((c) => onCustomerCreated(c.id, { createdByAdmin: true })))
    const withContact = await db.customer.findMany({ where: { id: { in: customers.map((c) => c.id) } }, select: { id: true, contactId: true } })
    await db.crmActivity.createMany({
      data: withContact.map((c) => ({ id: newId(), type: 'IMPORTED', summary: 'از فایل وارد شد', customerId: c.id, contactId: c.contactId, actorUserId: adminId, refType: 'import', refId: c.id })),
      skipDuplicates: true,
    })
  }
}
