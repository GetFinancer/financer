import { NextResponse } from 'next/server';

// Middleware is kept minimal - nginx handles landing page routing.
// This file exists for future app-specific middleware needs.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
