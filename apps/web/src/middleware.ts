import { NextRequest, NextResponse } from 'next/server';

// Landing page routes that should serve static HTML for unauthenticated users
const LANDING_ROUTES: Record<string, string> = {
  '/impressum': '/landing/impressum.html',
  '/datenschutz': '/landing/datenschutz.html',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const baseDomain = process.env.BASE_DOMAIN || 'getfinancer.com';

  // Check if this is the main domain (not a tenant subdomain)
  const isMainDomain =
    hostname === baseDomain ||
    hostname === `www.${baseDomain}` ||
    hostname.startsWith('localhost');

  // Landing page routes only on main domain
  if (isMainDomain && LANDING_ROUTES[pathname]) {
    return NextResponse.rewrite(new URL(LANDING_ROUTES[pathname], request.url));
  }

  // Root path on main domain: show landing page if no session cookie exists
  if (isMainDomain && pathname === '/') {
    const hasSession = request.cookies.has('connect.sid');
    if (!hasSession) {
      return NextResponse.rewrite(new URL('/landing/index.html', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/impressum', '/datenschutz'],
};
