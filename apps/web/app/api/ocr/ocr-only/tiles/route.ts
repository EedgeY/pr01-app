/**
 * OCR-only Tiles API Route
 *
 * Forwards tile-based OCR requests to OCR service and returns normalized results.
 * Tiles allow processing specific regions (segments) of pages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeOcrResponse } from '@workspace/ai/src/ocr';
import type { RawOcrResponse } from '@workspace/ai/src/ocr/types';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

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
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const tiles = formData.get('tiles') as string | null;
    const dpi = formData.get('dpi') as string | null;
    const device = formData.get('device') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!tiles) {
      return NextResponse.json({ error: 'No tiles provided' }, { status: 400 });
    }

    // Validate tiles JSON
    try {
      const parsed = JSON.parse(tiles);
      if (!Array.isArray(parsed)) {
        throw new Error('Tiles must be an array');
      }
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Invalid tiles JSON format',
          details: err instanceof Error ? err.message : 'Unknown error',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

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

    const ocrFormData = new FormData();
    ocrFormData.append('file', file);
    ocrFormData.append('tiles', tiles);
    ocrFormData.append('dpi', dpi || '72');
    ocrFormData.append('device', device || 'cpu');

    console.log(
      '[OCR Tiles API] Sending request to OCR service with',
      JSON.parse(tiles).length,
      'tiles'
    );

    const ocrResponse = await fetchWithRetry(
      `${OCR_SERVICE_URL}/ocr/ocr-only/tiles`,
      {
        method: 'POST',
        body: ocrFormData,
      }
    );

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error('OCR-only tiles service error:', errorText);
      return NextResponse.json(
        { error: 'OCR-only tiles processing failed', details: errorText },
        { status: 500 }
      );
    }

    const rawOcr: RawOcrResponse = await ocrResponse.json();

    const sourceFormat = file.type.split('/')[1] || 'unknown';
    const normalizedOcr = normalizeOcrResponse(rawOcr, sourceFormat);

    console.log(
      '[OCR Tiles API] Normalized OCR with',
      normalizedOcr.pages.length,
      'pages'
    );

    return NextResponse.json(normalizedOcr);
  } catch (error) {
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

    console.error('[OCR Tiles API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
