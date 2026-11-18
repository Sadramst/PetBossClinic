import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AdminShell } from '@/components/admin/admin-shell';

/**
 * Admin chrome. Server wrapper: reads the signed-in role (to hide links the role
 * cannot open) and the counters shown as nav badges, then hands off to the client shell.
 * Without a session only the login page can render (middleware redirects everything else),
 * so children are returned bare.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) return <>{children}</>;

  const [openOrders, unreadMessages, newLeads] = await Promise.all([
    db.order.count({ where: { status: { in: ['CONFIRMED', 'PROCESSING'] } } }),
    db.contactMessage.count({ where: { isRead: false } }),
    db.lead.count({ where: { status: 'NEW' } }),
  ]).catch(() => [0, 0, 0]);

  return (
    <AdminShell role={session.role} userName={session.name || session.email} badges={{ openOrders, unreadMessages, newLeads }}>
      {children}
    </AdminShell>
  );
}
