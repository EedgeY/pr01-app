/**
 * OCR Field Detection API Route
 *
 * Detects form input fields from OCR results using LLM vision
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectFormFields } from '@workspace/ai';
import { fieldsToTextSchemas } from '@workspace/ai/src/ocr';
import type { NormalizedOcr } from '@workspace/ai/src/ocr/types';
import type { ModelId } from '@workspace/ai/src/clients/openrouter';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ocr, textOcr, layoutOcr, image, page, segmentIndex, segmentConstraint, model } = body as {
      ocr?: NormalizedOcr;
      textOcr?: NormalizedOcr;
      layoutOcr?: NormalizedOcr;
      image?: string;
      page?: number;
      segmentIndex?: number;
      segmentConstraint?: {
        pageIndex: number;
        bboxNormalized: { x: number; y: number; w: number; h: number };
      };
      model?: ModelId;
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
      ...(segmentConstraint ? { segmentConstraint } : {}),
      ...(model ? { model } : {}),
    };

    // Call LLM to detect fields
    // 単一ソースモードの場合はocrを渡し、2ソースモードの場合はダミーのocrを渡す（後方互換性のため）
    const dummyOcr = useTwoSourceMode ? layoutOcr : ocr!;
    const result = await detectFormFields(dummyOcr, options);

    console.log('[Detect Fields API] Detected', result.fields.length, 'fields');

    // Convert detected fields to pdfme TextSchema
    const pdfmeSchemas = fieldsToTextSchemas(result.fields);

    // Save LLM debugging data (dev utility)
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const mode = useTwoSourceMode ? 'two-source' : 'single';
      const segmentSuffix = segmentIndex !== undefined ? `-seg${segmentIndex}` : '';
      const baseFilename = `llm-${mode}-page${pageHint}${segmentSuffix}-${timestamp}`;

      // 1. Save LLM output (result)
      const outDir = path.join(process.cwd(), 'public', 'llm-out');
      await mkdir(outDir, { recursive: true });
      const outFilename = `llm-fields-${mode}-page${pageHint}${segmentSuffix}-${timestamp}.json`;
      const outPath = path.join(outDir, outFilename);
      const payload = {
        mode,
        page: pageHint,
        segmentIndex: segmentIndex !== undefined ? segmentIndex : null,
        counts: {
          fields: result.fields.length,
          pages: result.metadata?.pageCount,
        },
        metadata: result.metadata,
        fields: result.fields,
        hasImage: Boolean(image),
        createdAt: new Date().toISOString(),
      };
      await writeFile(outPath, JSON.stringify(payload, null, 2), 'utf-8');
      console.log('[Detect Fields API] LLM output saved:', outPath);

      // 2. Save LLM input image
      if (image) {
        const imageDir = path.join(process.cwd(), 'public', 'llm-image');
        await mkdir(imageDir, { recursive: true });
        
        // Base64画像をデコードして保存
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // 画像形式を判定（デフォルトはpng）
        const imageFormat = image.match(/^data:image\/(\w+);base64,/)?.[1] || 'png';
        const imageFilename = `${baseFilename}.${imageFormat}`;
        const imagePath = path.join(imageDir, imageFilename);
        
        await writeFile(imagePath, buffer);
        console.log('[Detect Fields API] LLM input image saved:', imagePath);
      }

      // 3. Save LLM input OCR parameters
      const paramDir = path.join(process.cwd(), 'public', 'llm-param');
      await mkdir(paramDir, { recursive: true });
      const paramFilename = `${baseFilename}.json`;
      const paramPath = path.join(paramDir, paramFilename);
      
      const paramPayload = {
        mode,
        page: pageHint,
        segmentIndex: segmentIndex !== undefined ? segmentIndex : null,
        hasImage: Boolean(image),
        segmentConstraint: segmentConstraint ?? null,
        createdAt: new Date().toISOString(),
        // OCRデータを保存（画像は除外）
        ocr: useTwoSourceMode ? undefined : ocr,
        textOcr: useTwoSourceMode ? textOcr : undefined,
        layoutOcr: useTwoSourceMode ? layoutOcr : undefined,
      };
      
      await writeFile(paramPath, JSON.stringify(paramPayload, null, 2), 'utf-8');
      console.log('[Detect Fields API] LLM input params saved:', paramPath);

    } catch (saveErr) {
      // Non-fatal: continue response even if saving fails (e.g., read-only FS)
      console.warn('[Detect Fields API] Failed to save LLM debug data:', saveErr);
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
