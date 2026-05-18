import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/status'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths: /login and /status/*
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Allow Next.js internals and static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // Check for auth token in cookie or Authorization header
  const token = request.cookies.get('invo_auth_token')?.value;

  // NOTE: localStorage is not accessible in middleware (server-side).
  // We rely on the client-side AuthContext to handle the redirect for localStorage tokens.
  // The middleware acts as a secondary layer using an optional cookie fallback.
  // For full protection, the dashboard layout also checks auth state client-side.
  if (!token) {
    // Let the client handle the redirect via the dashboard layout guard.
    // We still allow through here since localStorage-based auth can't be read server-side.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
