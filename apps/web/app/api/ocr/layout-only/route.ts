/**
 * Layout-only API Route
 *
 * Forwards file uploads to OCR service (/ocr/layout) and returns normalized results.
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
    const dpi = formData.get('dpi') as string | null;
    const device = formData.get('device') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, PNG, JPG' },
        { status: 400 }
      );
    }

    const ocrFormData = new FormData();
    ocrFormData.append('file', file);
    ocrFormData.append('dpi', dpi || '300');
    ocrFormData.append('device', device || 'cpu');

    const response = await fetchWithRetry(`${OCR_SERVICE_URL}/ocr/layout`, {
      method: 'POST',
      body: ocrFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Layout-only service error:', errorText);
      return NextResponse.json(
        { error: 'Layout-only processing failed', details: errorText },
        { status: 500 }
      );
    }

    const raw: RawOcrResponse = await response.json();
    const sourceFormat = file.type.split('/')[1] || 'unknown';
    const normalized = normalizeOcrResponse(raw, sourceFormat);

    return NextResponse.json(normalized);
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
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const response = await fetchWithRetry(`${OCR_SERVICE_URL}/health`, { method: 'GET' });
    if (!response.ok) {
      return NextResponse.json(
        { status: 'unhealthy', service: 'ocr-service' },
        { status: 503 }
      );
    }
    const health = await response.json();
    return NextResponse.json({ status: 'ok', ocrService: health });
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


