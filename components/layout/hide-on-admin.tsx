'use client';

import { usePathname } from '@/i18n/routing';

/** Renders public-site chrome (footer etc.) everywhere except the admin panel. */
export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith('/admin') ? null : <>{children}</>;
}
