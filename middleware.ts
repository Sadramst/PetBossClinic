import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionTokenEdge } from '@/lib/auth/edge';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/fa/admin' ||
    pathname.startsWith('/fa/admin/') ||
    pathname === '/en/admin' ||
    pathname.startsWith('/en/admin/');

  const isLoginPage =
    pathname === '/admin/login' ||
    pathname === '/fa/admin/login' ||
    pathname === '/en/admin/login';

  const isEn = pathname.startsWith('/en');
  const loginPath = isEn ? '/en/admin/login' : '/admin/login';
  const adminPath = isEn ? '/en/admin' : '/admin';

  // Strict signature verification using Web Crypto (Edge runtime safe)
  let session = null;
  const sessionToken = request.cookies.get('petboss_session')?.value;
  if (sessionToken) {
    session = await verifySessionTokenEdge(sessionToken);
  }

  if (isAdminRoute && !isLoginPage) {
    if (!session) {
      const redirectUrl = new URL(loginPath, request.url);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      redirectResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return redirectResponse;
    }
  }

  if (isLoginPage && session) {
    const redirectUrl = new URL(adminPath, request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return redirectResponse;
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
