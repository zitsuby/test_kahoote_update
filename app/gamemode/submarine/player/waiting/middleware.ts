import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Handle old URL patterns and redirect to correct ones
  if (pathname.includes('/player/waiting/')) {
    const newPath = pathname.replace('/player/waiting/', '/gamemode/submarine/player/waiting/');
    return NextResponse.redirect(new URL(newPath, request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/player/waiting/:path*',
    '/gamemode/submarine/player/waiting/:path*'
  ]
};