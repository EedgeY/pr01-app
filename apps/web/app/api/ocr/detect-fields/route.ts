/**
 * OCR Field Detection API Route
 *
 * Detects form input fields from OCR results using LLM vision
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectFormFields } from '@workspace/ai';
import { fieldsToTextSchemas } from '@workspace/ai/src/ocr';
import type { NormalizedOcr } from '@workspace/ai/src/ocr/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ocr, image, page } = body as {
      ocr: NormalizedOcr;
      image?: string;
      page?: number;
    };

    if (!ocr || !ocr.pages || ocr.pages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid OCR data provided' },
        { status: 400 }
      );
    }

    console.log('[Detect Fields API] Processing OCR with', ocr.pages.length, 'pages');

    // Prepare options for field detection
    const pageHint = page ?? 0;
    const options = image
      ? {
          imagesByPage: { [pageHint]: image },
          pageHint,
        }
      : undefined;

    // Call LLM to detect fields
    const result = await detectFormFields(ocr, options);

    console.log('[Detect Fields API] Detected', result.fields.length, 'fields');

    // Convert detected fields to pdfme TextSchema
    const pdfmeSchemas = fieldsToTextSchemas(result.fields);

    return NextResponse.json({
      fields: result.fields,
      pdfmeSchemas,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('[Detect Fields API] Error:', error);

    return NextResponse.json(
      {
        error: 'Field detection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

