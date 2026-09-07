import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
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

  const sessionToken = request.cookies.get('petboss_session')?.value;
  const isEn = pathname.startsWith('/en');
  const loginPath = isEn ? '/en/admin/login' : '/admin/login';
  const adminPath = isEn ? '/en/admin' : '/admin';

  if (isAdminRoute && !isLoginPage) {
    if (!sessionToken) {
      const redirectUrl = new URL(loginPath, request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isLoginPage && sessionToken) {
    const redirectUrl = new URL(adminPath, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
