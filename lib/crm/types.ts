import type { Prisma } from '@prisma/client'
import type { db } from '@/lib/db'

/** Either the shared client or an open transaction: every CRM writer accepts both. */
export type DbClient = Prisma.TransactionClient | typeof db

export type Paged<T> = { rows: T[]; total: number; page: number; size: number }

export type DateRange = { from: Date; to: Date }

/** Hard cap for every list: no unbounded queries. */
export const MAX_PAGE_SIZE = 100

/** Clamps page and size from untrusted input. */
export function pageArgs(q: { page?: number; size?: number }, defaultSize = 25): { page: number; size: number; skip: number } {
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(q.size) || defaultSize)))
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  return { page, size, skip: (page - 1) * size }
}

/** Random id for raw inserts (Prisma generates cuids only for client-side creates). */
export function newId(): string {
  const rand = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, '')
  return `c${rand.slice(0, 24)}`
}

/** Escapes a user string for use inside a SQL LIKE/ILIKE pattern is handled by Prisma `contains`; this only trims and bounds it. */
export function cleanQuery(q: string | undefined | null, max = 80): string {
  return (q ?? '').trim().slice(0, max)
}
