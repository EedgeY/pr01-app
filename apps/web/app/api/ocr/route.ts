/**
 * OCR API Route
 *
 * Handles file upload, calls OCR service, and returns normalized results
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeOcrResponse } from '@workspace/ai/src/ocr';
import type { RawOcrResponse } from '@workspace/ai/src/ocr/types';

// Node runtime required for file handling
export const runtime = 'nodejs';

// 最大ファイルサイズ: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// OCRサービスのURL（環境変数から取得、デフォルトはローカル）
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000';

// リトライ設定
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2秒

/**
 * OCRサービスへのリクエストをリトライ付きで実行
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (
      retries > 0 &&
      error instanceof Error &&
      'code' in error &&
      (error as any).code === 'ECONNREFUSED'
    ) {
      // OCRサービスが起動中の可能性があるため、リトライ
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // FormDataを取得
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const dpi = formData.get('dpi') as string | null;
    const device = formData.get('device') as string | null;
    const lite = formData.get('lite') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // ファイルサイズチェック
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    // ファイル形式チェック
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, PNG, JPG' },
        { status: 400 }
      );
    }

    // OCRサービスに転送
    const ocrFormData = new FormData();
    ocrFormData.append('file', file);
    ocrFormData.append('dpi', dpi || '300');
    ocrFormData.append('device', device || 'cpu');
    ocrFormData.append('lite', lite || 'false');

    const ocrResponse = await fetchWithRetry(`${OCR_SERVICE_URL}/ocr`, {
      method: 'POST',
      body: ocrFormData,
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error('OCR service error:', errorText);
      return NextResponse.json(
        { error: 'OCR processing failed', details: errorText },
        { status: 500 }
      );
    }

    const rawOcr: RawOcrResponse = await ocrResponse.json();
    console.log('[OCR API] Raw OCR response pages:', rawOcr.pages?.length);

    // ファイル形式を判定
    const sourceFormat = file.type.split('/')[1] || 'unknown';

    // 正規化
    const normalizedOcr = normalizeOcrResponse(rawOcr, sourceFormat);

    console.log('[OCR API] Normalized OCR:', {
      pages: normalizedOcr.pages.length,
      totalBlocks: normalizedOcr.pages.reduce(
        (sum, p) => sum + p.blocks.length,
        0
      ),
      firstPageSize: normalizedOcr.pages[0]
        ? `${normalizedOcr.pages[0].widthPx}x${normalizedOcr.pages[0].heightPx}`
        : 'N/A',
    });

    return NextResponse.json(normalizedOcr);
  } catch (error) {
    console.error('OCR API error:', error);

    // 接続エラーの場合は特別なメッセージを返す
    if (
      error instanceof Error &&
      'code' in error &&
      (error as any).code === 'ECONNREFUSED'
    ) {
      return NextResponse.json(
        {
          error: 'OCRサービスに接続できません',
          details:
            'OCRサービスが起動していないか、起動中です。しばらく待ってから再度お試しください。',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  try {
    const response = await fetchWithRetry(`${OCR_SERVICE_URL}/health`, {
      method: 'GET',
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: 'unhealthy', service: 'ocr-service' },
        { status: 503 }
      );
    }

    const health = await response.json();

    return NextResponse.json({
      status: 'ok',
      ocrService: health,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
