import type { Role } from '@prisma/client'

/** Same hierarchy as lib/auth (SUPER_ADMIN > ADMIN > EDITOR > AUTHOR > VIEWER), kept pure for tests and filters. */
export const ROLE_RANK: Record<Role, number> = { SUPER_ADMIN: 5, ADMIN: 4, EDITOR: 3, AUTHOR: 2, VIEWER: 1 }

export function roleAtLeast(role: Role | string | null | undefined, min: Role | string | null | undefined): boolean {
  if (!min) return true
  const r = ROLE_RANK[role as Role]
  const m = ROLE_RANK[min as Role]
  return !!r && !!m && r >= m
}

/** Roles whose rank is at least `min`: for Prisma `role: { in }` filters. */
export function rolesAtLeast(min: Role): Role[] {
  return (Object.keys(ROLE_RANK) as Role[]).filter((r) => ROLE_RANK[r] >= ROLE_RANK[min])
}
