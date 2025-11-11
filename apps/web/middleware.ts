import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 保護されたルート（認証が必要）
const protectedRoutes = ['/ocr-viewer'];

// 認証済みユーザーがアクセスできないルート
const authRoutes = ['/sign-in', '/sign-up'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // セッションCookieの存在確認（Better Authのデフォルトcookie名）
  const sessionCookie = request.cookies.get('better-auth.session_token');
  const isAuthenticated = !!sessionCookie;

  let res = NextResponse.next();

  // 保護されたルートへのアクセス
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      res = NextResponse.redirect(signInUrl);
    }
  }

  // 認証ページへのアクセス（既にログイン済みの場合）
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    if (isAuthenticated) {
      res = NextResponse.redirect(new URL('/ocr-viewer', request.url));
    }
  }

  // CSRFトークン（ダブルサブミット用）を未発行なら付与
  if (request.method === 'GET' && !pathname.startsWith('/api')) {
    if (!request.cookies.get('csrf_token')?.value) {
      const token = crypto.randomUUID().replace(/-/g, '');
      res.cookies.set('csrf_token', token, {
        path: '/',
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        // httpOnlyはfalse（クライアントが読み出してヘッダーに載せるため）
      });
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
