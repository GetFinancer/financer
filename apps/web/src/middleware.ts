import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // In cloudhost mode: /admin is only accessible from the base domain.
  // Tenant subdomains (e.g. rr.getfinancer.com/admin) redirect to /.
  if (process.env.DEPLOYMENT_MODE === 'cloudhost' && request.nextUrl.pathname === '/admin') {
    const host = request.headers.get('host') || '';
    const baseDomain = process.env.BASE_DOMAIN || 'getfinancer.com';
    const isTenantSubdomain = host !== baseDomain && host.endsWith(`.${baseDomain}`);
    if (isTenantSubdomain) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
