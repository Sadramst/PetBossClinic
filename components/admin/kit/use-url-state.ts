'use client'

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { usePathname, useRouter } from '@/i18n/routing'

export type UrlStatePatch<T> = { [K in keyof T]?: T[K] | null }

/**
 * Keeps list state (q, filters, sort, page, size) in the URL so a view can be shared.
 * Values equal to the default are removed from the URL. Any change except `page`
 * resets `page` to the first page.
 */
export function useUrlState<T extends Record<string, string | number>>(
  defaults: T,
): [T, (patch: UrlStatePatch<T>) => void] {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const defKey = JSON.stringify(defaults)

  const state = useMemo(() => {
    const out: Record<string, string | number> = { ...defaults }
    for (const key of Object.keys(defaults)) {
      const raw = params.get(key)
      if (raw === null || raw === '') continue
      out[key] = typeof defaults[key] === 'number' ? (Number.isFinite(Number(raw)) ? Number(raw) : defaults[key]) : raw
    }
    return out as T
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, defKey])

  const patch = useCallback(
    (next: UrlStatePatch<T>) => {
      const sp = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(next)) {
        const def = (defaults as Record<string, string | number>)[key]
        if (value === null || value === undefined || value === '' || value === def) sp.delete(key)
        else sp.set(key, String(value))
      }
      if (!('page' in next)) sp.delete('page')
      const qs = sp.toString()
      router.replace((qs ? `${pathname}?${qs}` : pathname) as never, { scroll: false })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, pathname, router, defKey],
  )

  return [state, patch]
}
