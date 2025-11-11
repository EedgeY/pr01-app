/**
 * OCR Field Detection API Route
 *
 * Detects form input fields from OCR results using LLM vision
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectFormFields } from '@workspace/ai';
import { fieldsToTextSchemas } from '@workspace/ai/src/ocr';
import type { NormalizedOcr } from '@workspace/ai/src/ocr/types';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

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

    // Save LLM result to public/llm-out for inspection (dev utility)
    try {
      const outDir = path.join(process.cwd(), 'public', 'llm-out');
      await mkdir(outDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const mode = useTwoSourceMode ? 'two-source' : 'single';
      const filename = `llm-fields-${mode}-page${pageHint}-${timestamp}.json`;
      const outPath = path.join(outDir, filename);
      const payload = {
        mode,
        page: pageHint,
        counts: {
          fields: result.fields.length,
          pages: result.metadata?.pageCount,
        },
        metadata: result.metadata,
        fields: result.fields,
        // image presence only flag to avoid huge files
        hasImage: Boolean(image),
        createdAt: new Date().toISOString(),
      };
      await writeFile(outPath, JSON.stringify(payload, null, 2), 'utf-8');
      console.log('[Detect Fields API] LLM output saved:', outPath);
    } catch (saveErr) {
      // Non-fatal: continue response even if saving fails (e.g., read-only FS)
      console.warn('[Detect Fields API] Failed to save LLM output:', saveErr);
    }

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
