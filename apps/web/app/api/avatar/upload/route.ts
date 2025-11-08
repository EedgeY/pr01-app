import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@workspace/auth';
import { getS3Client, buildAvatarKey } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from '@workspace/db/client';
import { user } from '@workspace/db/schema';
import { eq } from '@workspace/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  const contentType = file.type || 'application/octet-stream';
  const size = file.size || 0;
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(contentType)) {
    return NextResponse.json({ error: 'unsupported content type' }, { status: 400 });
  }
  if (size <= 0 || size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }

  const key = buildAvatarKey({ userId: session.user.id, fileName: file.name, contentType });
  const s3 = getS3Client();
  const bucket = process.env.R2_BUCKET as string;

  const body = Buffer.from(await file.arrayBuffer());
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));

  const imageUrl = `/api/avatars/${key}`;
  await db.update(user).set({ image: imageUrl }).where(eq(user.id, session.user.id));

  return NextResponse.json({ ok: true, imageUrl, key });
}


