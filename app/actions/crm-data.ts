'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { getSessionWithRole } from '@/lib/auth'
import { logAdminChange } from '@/lib/audit'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { CrmError, MSG, isCrmError } from '@/lib/crm/errors'
import { findDuplicates, type DuplicateCandidate } from '@/lib/crm/dedupe'
import { mergeCustomers, type MergeReport } from '@/lib/crm/merge'
import { MAX_IMPORT_ROWS, parseImportCsv, previewImport, commitImport, type ImportError, type PreviewRow } from '@/lib/crm/import'
import { listViews, saveView, deleteView, SAVED_VIEW_ENTITIES, type SavedViewEntity, type SavedViewRow } from '@/lib/crm/views'

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

type Guard = { ok: true; userId: string; role: Role } | { ok: false; error: string }

async function guard(min: Role, bucket: string, max: number): Promise<Guard> {
  const session = await getSessionWithRole(min)
  if (!session) return { ok: false, error: MSG.denied }
  if (!checkRateLimit(`crm-data-${bucket}:${session.userId}`, max, 60_000).allowed) return { ok: false, error: MSG.busy }
  return { ok: true, userId: session.userId, role: session.role }
}

function fail(e: unknown): { ok: false; error: string } {
  if (isCrmError(e)) return { ok: false, error: e.message }
  console.error('[crm-data]', e)
  return { ok: false, error: MSG.generic }
}

const idSchema = z.string().trim().min(1).max(40)
const entitySchema = z.enum(SAVED_VIEW_ENTITIES as unknown as [SavedViewEntity, ...SavedViewEntity[]])
const csvSchema = z.string().max(2_000_000)

/* ---------------------------------------------------------------- duplicates */

export async function findDuplicatesAction(): Promise<Result<DuplicateCandidate[]>> {
  const g = await guard('EDITOR', 'dups', 20)
  if (!g.ok) return g
  try {
    return { ok: true, data: await findDuplicates({ limit: 100 }) }
  } catch (e) {
    return fail(e)
  }
}

export async function mergeCustomersAction(survivorId: string, loserId: string, dryRun = true): Promise<Result<MergeReport>> {
  const g = await guard('ADMIN', dryRun ? 'merge-dry' : 'merge', dryRun ? 30 : 10)
  if (!g.ok) return g
  const p = z.object({ s: idSchema, l: idSchema }).safeParse({ s: survivorId, l: loserId })
  if (!p.success) return { ok: false, error: MSG.badInput }
  try {
    const report = await mergeCustomers(p.data.s, p.data.l, g.userId, { dryRun: !!dryRun })
    if (!dryRun) {
      await logAdminChange({ action: 'MERGE', entity: 'CUSTOMER', entityId: p.data.s, details: { loserId: p.data.l, moved: report.moved } })
      revalidatePath('/admin/customers')
      revalidatePath(`/admin/customers/${p.data.s}`)
      revalidatePath('/admin/customers/duplicates')
    }
    return { ok: true, data: report }
  } catch (e) {
    return fail(e)
  }
}

/* ------------------------------------------------------------------- import */

export type ImportPreview = { valid: number; duplicates: number; invalid: number; rows: PreviewRow[]; errors: ImportError[]; total: number; truncated: boolean }

export async function previewImportAction(csvText: string): Promise<Result<ImportPreview>> {
  const g = await guard('ADMIN', 'import-preview', 15)
  if (!g.ok) return g
  const p = csvSchema.safeParse(csvText)
  if (!p.success) return { ok: false, error: 'فایل بیش از حد بزرگ است.' }
  try {
    const parsed = parseImportCsv(p.data)
    const rows = parsed.rows.slice(0, MAX_IMPORT_ROWS)
    const pv = await previewImport(rows)
    return {
      ok: true,
      data: { ...pv, rows: pv.rows.slice(0, 200), errors: parsed.errors.slice(0, 200), total: parsed.rows.length + parsed.errors.length, truncated: parsed.rows.length > MAX_IMPORT_ROWS },
    }
  } catch (e) {
    return fail(e)
  }
}

export async function commitImportAction(csvText: string): Promise<Result<{ created: number; skipped: number }>> {
  const g = await guard('ADMIN', 'import-commit', 5)
  if (!g.ok) return g
  const p = csvSchema.safeParse(csvText)
  if (!p.success) return { ok: false, error: 'فایل بیش از حد بزرگ است.' }
  try {
    const parsed = parseImportCsv(p.data)
    if (parsed.rows.length > MAX_IMPORT_ROWS) throw new CrmError('TOO_MANY', `هر فایل حداکثر ${MAX_IMPORT_ROWS} ردیف می‌تواند داشته باشد.`)
    const res = await commitImport(parsed.rows, g.userId)
    await logAdminChange({ action: 'IMPORT', entity: 'CUSTOMER', entityId: 'bulk', details: { created: res.created, skipped: res.skipped, invalid: parsed.errors.length } })
    revalidatePath('/admin/customers')
    return { ok: true, data: { created: res.created, skipped: res.skipped + parsed.errors.length } }
  } catch (e) {
    return fail(e)
  }
}

/* -------------------------------------------------------------- saved views */

export async function listViewsAction(entity: SavedViewEntity): Promise<Result<SavedViewRow[]>> {
  const g = await guard('VIEWER', 'views-list', 120)
  if (!g.ok) return g
  const p = entitySchema.safeParse(entity)
  if (!p.success) return { ok: false, error: MSG.badInput }
  try {
    return { ok: true, data: await listViews(p.data, g.userId, g.role) }
  } catch (e) {
    return fail(e)
  }
}

export async function saveViewAction(v: { entity: SavedViewEntity; name: string; filters: unknown; sort?: string; shared?: boolean }): Promise<Result<SavedViewRow>> {
  const g = await guard('EDITOR', 'views-save', 40)
  if (!g.ok) return g
  const p = z.object({ entity: entitySchema, name: z.string().trim().min(1).max(60), sort: z.string().max(40).optional(), shared: z.boolean().optional() }).safeParse(v)
  if (!p.success) return { ok: false, error: MSG.badInput }
  try {
    return { ok: true, data: await saveView({ ...p.data, filters: v.filters }, g.userId, g.role) }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteViewAction(id: string): Promise<Result<null>> {
  const g = await guard('EDITOR', 'views-del', 40)
  if (!g.ok) return g
  const p = idSchema.safeParse(id)
  if (!p.success) return { ok: false, error: MSG.badInput }
  try {
    await deleteView(p.data, g.userId, g.role)
    return { ok: true, data: null }
  } catch (e) {
    return fail(e)
  }
}
