/**
 * クライアント側でCookieを取得するユーティリティ
 * @param name - Cookie名
 * @returns Cookie値、存在しない場合はnull
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const pattern = new RegExp(
    '(?:^|; )' + name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&') + '=([^;]*)'
  );
  const match = document.cookie.match(pattern);

  return match ? decodeURIComponent(match[1] ?? '') : null;
}
