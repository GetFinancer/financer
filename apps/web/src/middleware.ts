import { NextRequest, NextResponse } from 'next/server';

// Landing page routes that should serve static HTML for unauthenticated users
const LANDING_ROUTES: Record<string, string> = {
  '/impressum': '/landing/impressum.html',
  '/datenschutz': '/landing/datenschutz.html',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /impressum and /datenschutz always show landing page versions
  if (LANDING_ROUTES[pathname]) {
    return NextResponse.rewrite(new URL(LANDING_ROUTES[pathname], request.url));
  }

  // Root path: show landing page if no session cookie exists
  if (pathname === '/') {
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
