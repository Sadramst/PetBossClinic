'use server'

import { getSessionWithRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { searchAdmin, type SearchGroup } from '@/lib/admin/search'

export type GlobalSearchResult = { ok: true; data: SearchGroup[] } | { ok: false; error: string }

/** Command-palette search. VIEWER and up, 2+ characters, 60 queries a minute per user. */
export async function globalSearchAction(q: string): Promise<GlobalSearchResult> {
  const session = await getSessionWithRole('VIEWER')
  if (!session) return { ok: false, error: 'دسترسی غیرمجاز.' }
  const text = typeof q === 'string' ? q.trim() : ''
  if (text.length < 2) return { ok: true, data: [] }
  const limit = checkRateLimit(`admin-search:${session.userId}`, 60, 60_000)
  if (!limit.allowed) return { ok: false, error: 'تعداد جست‌وجو زیاد است. چند ثانیه صبر کنید.' }
  try {
    return { ok: true, data: await searchAdmin(text, session.role) }
  } catch {
    return { ok: false, error: 'جست‌وجو انجام نشد. دوباره تلاش کنید.' }
  }
}
