import { NextResponse } from 'next/server';
import { getObject } from '@/lib/r2';
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string[] }> }
) {
  const { key: keySegments } = await ctx.params;
  const key = keySegments.join('/');
  if (!key) {
    return NextResponse.json({ error: 'key required' }, { status: 400 });
  }

  try {
    const res = await getObject({ key });
    const body = res.Body as unknown as Readable;
    // Node Readable -> Buffer (型問題を回避するために一括読み込み)
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    const headers: Record<string, string> = {
      'Content-Type': res.ContentType || 'application/octet-stream',
      'Cache-Control': res.CacheControl || 'public, max-age=3600',
      'Content-Length': String(buffer.length),
    };
    if (res.ETag) headers['ETag'] = res.ETag;
    if (res.LastModified)
      headers['Last-Modified'] = new Date(res.LastModified).toUTCString();

    return new Response(buffer, { headers });
  } catch (e) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
