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

  // Main domain: redirect all other routes to landing page (no tenant exists)
  if (isMainDomain) {
    return NextResponse.rewrite(new URL('/landing/index.html', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files and API
  matcher: ['/((?!_next/static|_next/image|landing|favicon.ico|api).*)'],
};
