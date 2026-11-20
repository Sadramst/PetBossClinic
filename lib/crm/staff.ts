import { db } from '@/lib/db'

export type StaffOption = { id: string; name: string }

/** Staff who can own work: EDITOR and above, not deleted. Small list (clinic team), safe to ship to the client. */
export async function listStaffOptions(): Promise<StaffOption[]> {
  const users = await db.user.findMany({
    where: { deletedAt: null, role: { in: ['EDITOR', 'ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    take: 100,
  })
  return users.map((u) => ({ id: u.id, name: u.name || u.email || 'کاربر' }))
}
