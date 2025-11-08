import { auth } from '@workspace/auth';
import { getSignedPutUrl } from '@/lib/r2';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { designId, contentType, fileName, purpose } = body;

    if (!designId || !contentType) {
      return NextResponse.json(
        { error: 'designId and contentType are required' },
        { status: 400 }
      );
    }

    // ファイル拡張子を決定
    let ext = '';
    if (fileName && fileName.includes('.')) {
      ext = fileName.substring(fileName.lastIndexOf('.'));
    } else if (contentType.includes('png')) {
      ext = '.png';
    } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      ext = '.jpg';
    } else if (contentType.includes('webp')) {
      ext = '.webp';
    } else if (contentType.includes('svg')) {
      ext = '.svg';
    }

    // R2のキーを生成
    const id = randomUUID();
    let key: string;
    if (purpose === 'thumbnail') {
      key = `thumbnails/${id}${ext}`;
    } else {
      key = `designs/${designId}/assets/${id}${ext}`;
    }

    // 署名付きURLを取得
    const signedUrl = await getSignedPutUrl({
      key,
      contentType,
      expiresInSeconds: 300, // 5分
    });

    return NextResponse.json({
      url: signedUrl,
      key,
    });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}

