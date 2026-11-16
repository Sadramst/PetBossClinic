import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionTokenEdge } from '@/lib/auth/edge';

const intlMiddleware = createMiddleware(routing);

/**
 * Legacy locale prefixes. The English version was retired and the site is
 * Farsi-only with unprefixed URLs, so /en/... and /fa/... permanently redirect
 * to the bare path. This keeps any backlinks and indexed URLs' ranking.
 */
const LEGACY_PREFIX = /^\/(en|fa)(?=\/|$)/;

export default async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (LEGACY_PREFIX.test(pathname)) {
    const target = new URL(request.url);
    target.pathname = pathname.replace(LEGACY_PREFIX, '') || '/';
    target.search = search;
    return NextResponse.redirect(target, 301);
  }

  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isLoginPage = pathname === '/admin/login';

  if (isAdminRoute) {
    const sessionToken = request.cookies.get('petboss_session')?.value;
    const session = sessionToken ? await verifySessionTokenEdge(sessionToken) : null;

    if (!isLoginPage && !session) {
      const res = NextResponse.redirect(new URL('/admin/login', request.url));
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return res;
    }

    if (isLoginPage && session) {
      const res = NextResponse.redirect(new URL('/admin', request.url));
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return res;
    }
  }

  const response = intlMiddleware(request);

  if (isAdminRoute) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
