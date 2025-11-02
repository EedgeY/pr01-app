import { NextRequest } from 'next/server';

/**
 * 同一オリジン検証（Origin/Refererヘッダーをチェック）
 * @param request - Next.jsリクエスト
 * @throws {Error} オリジンが許可リストに含まれない場合
 */
export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const inferred = origin ?? (referer ? new URL(referer).origin : null);

  const allowed = new Set(
    [
      request.nextUrl.origin,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    ].filter(Boolean) as string[]
  );

  if (!inferred || !allowed.has(inferred)) {
    throw new Error('Forbidden: invalid origin');
  }
}

/**
 * CSRFトークン検証（ダブルサブミット方式）
 * @param request - Next.jsリクエスト
 * @throws {Error} CSRFトークンが一致しない場合
 */
export async function assertCsrf(request: NextRequest) {
  const cookie = request.cookies.get('csrf_token')?.value;
  let token = request.headers.get('x-csrf-token') ?? undefined;

  // フォームPOST（application/x-www-form-urlencoded, multipart/form-data）の場合はボディからも許可
  if (!token) {
    const contentType = request.headers.get('content-type') || '';
    if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      try {
        const form = await request.formData();
        token = (
          form.get('_csrf') ||
          form.get('csrf_token') ||
          form.get('x-csrf-token')
        )?.toString();
      } catch {
        // noop
      }
    }
  }

  if (!cookie || !token || cookie !== token) {
    throw new Error('Forbidden: CSRF token invalid');
  }
}

