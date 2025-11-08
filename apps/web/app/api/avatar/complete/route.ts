import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@workspace/auth';
import { db } from '@workspace/db/client';
import { user } from '@workspace/db/schema';
import { eq } from '@workspace/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const key = body?.key as string | undefined;
  const contentType = body?.contentType as string | undefined;
  const size = Number(body?.size ?? 0);

  if (!key) {
    return NextResponse.json({ error: 'key required' }, { status: 400 });
  }

  // 簡易バリデーション: avatar キーのみ受け付ける
  if (!key.startsWith(`avatars/${session.user.id}/`)) {
    return NextResponse.json({ error: 'invalid key' }, { status: 400 });
  }

  // 追加で記録したい場合は別テーブルでメタを保持しても良い
  const imageUrl = `/api/avatars/${key}`;

  await db
    .update(user)
    .set({ image: imageUrl })
    .where(eq(user.id, session.user.id));

  return NextResponse.json({ ok: true, imageUrl, contentType, size });
}
