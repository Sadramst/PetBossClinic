import { getSession } from '@/lib/auth';
import { AdminShell } from '@/components/admin/admin-shell';
import { getNotifications, getShellBadges } from '@/lib/admin/shell-data';

/**
 * Admin chrome. Server wrapper: reads the signed-in role (to hide links the role
 * cannot open), the nav counters (one cached parallel batch) and the notification list,
 * then hands off to the client shell.
 * Without a session only the login page can render (middleware redirects everything else),
 * so children are returned bare.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) return <>{children}</>;

  const [badges, notifications] = await Promise.all([getShellBadges(), getNotifications(session.userId, session.role)]);

  return (
    <AdminShell role={session.role} userName={session.name || session.email} badges={badges} notifications={notifications}>
      {children}
    </AdminShell>
  );
}
