import { NextResponse, type NextRequest } from 'next/server';

// Pages anyone can open. Everything else needs a session cookie; the cookie
// itself is verified against the database by each page and action.
const PUBLIC = ['/login', '/setup', '/contact', '/t/', '/api/contact', '/api/portal/', '/api/attachments/'];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : p + '/'))) return NextResponse.next();
  if (!req.cookies.get('hd_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
