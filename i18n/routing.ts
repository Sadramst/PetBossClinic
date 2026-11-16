import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

// The site is Farsi-only. English was removed for SEO focus; every legacy
// /en/* URL is 301-redirected to its Farsi equivalent in middleware.ts.
export const routing = defineRouting({
  locales: ['fa'],
  defaultLocale: 'fa',
  localePrefix: 'never',
  localeDetection: false,
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
