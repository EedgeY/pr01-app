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
    const { ocr, textOcr, layoutOcr, image, page } = body as {
      ocr?: NormalizedOcr;
      textOcr?: NormalizedOcr;
      layoutOcr?: NormalizedOcr;
      image?: string;
      page?: number;
    };

    // 2ソースモード（textOcr + layoutOcr）または単一ソースモード（ocr）のいずれかが必要
    const useTwoSourceMode = !!(textOcr && layoutOcr);

    if (useTwoSourceMode) {
      // 2ソースモードの検証
      if (!textOcr.pages || textOcr.pages.length === 0) {
        return NextResponse.json(
          { error: 'Invalid textOcr data provided' },
          { status: 400 }
        );
      }
      if (!layoutOcr.pages || layoutOcr.pages.length === 0) {
        return NextResponse.json(
          { error: 'Invalid layoutOcr data provided' },
          { status: 400 }
        );
      }
      console.log(
        '[Detect Fields API] TWO-SOURCE mode: text-only + layout-only'
      );
      console.log('[Detect Fields API] Text OCR pages:', textOcr.pages.length);
      console.log(
        '[Detect Fields API] Layout OCR pages:',
        layoutOcr.pages.length
      );
    } else {
      // 単一ソースモードの検証
      if (!ocr || !ocr.pages || ocr.pages.length === 0) {
        return NextResponse.json(
          { error: 'Invalid OCR data provided' },
          { status: 400 }
        );
      }
      console.log('[Detect Fields API] SINGLE-SOURCE mode: unified OCR');
      console.log(
        '[Detect Fields API] Processing OCR with',
        ocr.pages.length,
        'pages'
      );
    }

    // Prepare options for field detection
    const pageHint = page ?? 0;
    const options = {
      ...(image
        ? { imagesByPage: { [pageHint]: image }, pageHint }
        : { pageHint }),
      ...(useTwoSourceMode ? { textOcr, layoutOcr } : {}),
    };

    // Call LLM to detect fields
    // 単一ソースモードの場合はocrを渡し、2ソースモードの場合はダミーのocrを渡す（後方互換性のため）
    const dummyOcr = useTwoSourceMode ? layoutOcr : ocr!;
    const result = await detectFormFields(dummyOcr, options);

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
