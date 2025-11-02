import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@workspace/auth';
import { buildAvatarKey, getSignedPutUrl } from '@/lib/r2';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const contentType = body?.contentType as string | undefined;
  const contentLength = Number(body?.contentLength ?? 0);
  const fileName = body?.fileName as string | undefined;

  if (!contentType) {
    return NextResponse.json(
      { error: 'contentType required' },
      { status: 400 }
    );
  }

  // 許可するMIMEタイプ
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(contentType)) {
    return NextResponse.json(
      { error: 'unsupported content type' },
      { status: 400 }
    );
  }

  // 5MB 制限（必要に応じて調整）
  if (
    !Number.isFinite(contentLength) ||
    contentLength <= 0 ||
    contentLength > 5 * 1024 * 1024
  ) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }

  const key = buildAvatarKey({
    userId: session.user.id,
    fileName,
    contentType,
  });
  const uploadUrl = await getSignedPutUrl({
    key,
    contentType,
    expiresInSeconds: 300,
  });

  return NextResponse.json({ uploadUrl, key });
}
