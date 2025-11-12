/**
 * Form Fields Detection API Route
 *
 * Receives normalized OCR data and returns detected form fields
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  detectFormFields,
  validateFields,
  sortFieldsByReadingOrder,
} from '@workspace/ai';
import type { NormalizedOcr } from '@workspace/ai';
import type { ModelId } from '@workspace/ai/src/clients/openrouter';

// Node runtime required
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ocr: NormalizedOcr = body.ocr;
    const model: ModelId | undefined = body.model;

    console.log('[Fields API] Received OCR data:', {
      pages: ocr?.pages?.length,
      totalBlocks: ocr?.pages?.reduce((sum, p) => sum + p.blocks.length, 0),
      model,
    });

    if (!ocr || !ocr.pages || ocr.pages.length === 0) {
      return NextResponse.json({ error: 'Invalid OCR data' }, { status: 400 });
    }

    // フィールド検出
    console.log('[Fields API] Starting field detection...');
    const result = await detectFormFields(ocr, { model });
    console.log('[Fields API] Detection result:', {
      detectedFields: result.fields.length,
      metadata: result.metadata,
    });

    // 検証とフィルタリング
    const validatedFields = validateFields(result.fields);
    console.log('[Fields API] After validation:', validatedFields.length);

    // 読み順でソート
    const sortedFields = sortFieldsByReadingOrder(validatedFields);
    console.log('[Fields API] After sorting:', sortedFields.length);

    const response = {
      fields: sortedFields,
      metadata: {
        ...result.metadata,
        totalFields: sortedFields.length,
        filteredCount: result.fields.length - sortedFields.length,
      },
    };

    console.log('[Fields API] Returning response:', {
      fieldsCount: response.fields.length,
      metadata: response.metadata,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Fields detection error:', error);
    return NextResponse.json(
      {
        error: 'Field detection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
