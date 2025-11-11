/**
 * Segment-based OCR and Field Detection API Route
 *
 * Splits PDF into segments, runs OCR on each segment separately,
 * detects fields per segment, and merges results with IoU-based deduplication.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  buildMaskedPdfSegments,
  validateSegments,
  type SegmentSpec,
} from '@workspace/ai/src/ocr/segmentPdf';
import {
  mergeDetectedFieldsAcrossSegments,
} from '@workspace/ai/src/ocr/merge';
import {
  normalizeOcrResponse,
  fieldsToTextSchemas,
} from '@workspace/ai/src/ocr';
import {
  detectFormFields,
  validateFields,
  sortFieldsByReadingOrder,
} from '@workspace/ai';
import type { RawOcrResponse, NormalizedOcr } from '@workspace/ai/src/ocr/types';
import type { DetectedField } from '@workspace/ai';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

/**
 * Fetch with retry for OCR service connection
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
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

/**
 * Run OCR on a segment PDF
 */
async function runOcrOnSegment(
  segmentPdf: Uint8Array,
  dpi: string,
  device: string,
  endpoint: 'ocr-only' | 'layout'
): Promise<NormalizedOcr> {
  const formData = new FormData();
  // Convert Uint8Array to Blob (use ArrayBuffer slice to ensure compatibility)
  const arrayBuffer = segmentPdf.buffer.slice(
    segmentPdf.byteOffset,
    segmentPdf.byteOffset + segmentPdf.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  formData.append('file', blob, 'segment.pdf');
  formData.append('dpi', dpi);
  formData.append('device', device);

  const response = await fetchWithRetry(`${OCR_SERVICE_URL}/ocr/${endpoint}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR ${endpoint} failed: ${errorText}`);
  }

  const rawOcr: RawOcrResponse = await response.json();
  return normalizeOcrResponse(rawOcr, 'pdf');
}

/**
 * POST handler for segment-based field detection
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const segmentsJson = formData.get('segments') as string | null;
    const dpi = (formData.get('dpi') as string) || '300';
    const device = (formData.get('device') as string) || 'cpu';
    const twoSource = (formData.get('twoSource') as string) !== 'false'; // default true
    const lite = formData.get('lite') as string | null;

    // Validate inputs
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

    if (!segmentsJson) {
      return NextResponse.json(
        { error: 'No segments provided' },
        { status: 400 }
      );
    }

    // Parse and validate segments
    let segments: SegmentSpec[];
    try {
      segments = JSON.parse(segmentsJson);
      validateSegments(segments);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Invalid segments',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 }
      );
    }

    console.log(`[Segment Detect API] Processing ${segments.length} segments`);
    console.log(`[Segment Detect API] Two-source mode: ${twoSource}`);

    // Convert file to Uint8Array
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Generate segment PDFs
    console.log('[Segment Detect API] Generating segment PDFs...');
    const segmentPdfs = await buildMaskedPdfSegments(
      fileBytes,
      segments,
      file.type === 'application/pdf'
    );
    console.log(`[Segment Detect API] Generated ${segmentPdfs.length} segment PDFs`);

    // Process each segment in parallel
    console.log('[Segment Detect API] Running OCR on all segments...');
    const segmentResults = await Promise.all(
      segmentPdfs.map(async (segmentPdf: Uint8Array, idx: number) => {
        console.log(`[Segment Detect API] Processing segment ${idx + 1}/${segmentPdfs.length}`);

        // Run OCR (text-only and layout-only if twoSource is enabled)
        const ocrPromises: Promise<NormalizedOcr>[] = [
          runOcrOnSegment(segmentPdf, dpi, device, 'ocr-only'),
        ];

        if (twoSource) {
          ocrPromises.push(runOcrOnSegment(segmentPdf, dpi, device, 'layout'));
        }

        const ocrResults = await Promise.all(ocrPromises);
        const textOcr = ocrResults[0];
        const layoutOcr = twoSource ? ocrResults[1] : undefined;

        if (!textOcr) {
          throw new Error(`Segment ${idx + 1}: OCR failed - no result returned`);
        }

        console.log(`[Segment Detect API] Segment ${idx + 1}: OCR complete (${textOcr.pages.length} pages)`);

        // Detect fields using LLM
        const options = twoSource && layoutOcr
          ? { textOcr, layoutOcr, pageHint: 0 }
          : { pageHint: 0 };

        const dummyOcr = layoutOcr || textOcr;
        const fieldResult = await detectFormFields(dummyOcr, options);

        console.log(`[Segment Detect API] Segment ${idx + 1}: Detected ${fieldResult.fields.length} fields`);

        return {
          segmentIndex: idx,
          fields: fieldResult.fields,
          metadata: fieldResult.metadata,
        };
      })
    );

    console.log('[Segment Detect API] All segments processed');

    // Merge results across segments with IoU-based deduplication
    console.log('[Segment Detect API] Merging segment results...');
    const allSegmentFields = segmentResults.map((r: { segmentIndex: number; fields: DetectedField[]; metadata: any }) => r.fields);
    const mergedFields = mergeDetectedFieldsAcrossSegments(allSegmentFields, 0.5);

    console.log(`[Segment Detect API] Merged to ${mergedFields.length} unique fields`);

    // Validate and sort merged fields
    const validFields = validateFields(mergedFields);
    const sortedFields = sortFieldsByReadingOrder(validFields);

    // Convert to pdfme schemas
    const pdfmeSchemas = fieldsToTextSchemas(sortedFields);

    const processingTimeMs = Date.now() - startTime;

    // Save debug output (dev utility)
    if (process.env.NODE_ENV === 'development') {
      try {
        const outDir = path.join(process.cwd(), 'public', 'llm-out');
        await mkdir(outDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `segment-detect-${timestamp}.json`;
        const outPath = path.join(outDir, filename);

        const debugPayload = {
          segments: segments.length,
          twoSource,
          perSegment: segmentResults.map((r: { segmentIndex: number; fields: DetectedField[]; metadata: any }) => ({
            segmentIndex: r.segmentIndex,
            fields: r.fields,
            counts: {
              fields: r.fields.length,
            },
          })),
          merged: {
            totalFields: mergedFields.length,
            validFields: validFields.length,
            sortedFields: sortedFields.length,
          },
          fields: sortedFields,
          processingTimeMs,
          createdAt: new Date().toISOString(),
        };

        await writeFile(outPath, JSON.stringify(debugPayload, null, 2), 'utf-8');
        console.log('[Segment Detect API] Debug output saved:', outPath);
      } catch (saveErr) {
        console.warn('[Segment Detect API] Failed to save debug output:', saveErr);
      }
    }

    // Return response
    return NextResponse.json({
      fields: sortedFields,
      pdfmeSchemas,
      metadata: {
        segmentCount: segments.length,
        pageCount: 1, // Assuming single page for now
        processingTimeMs,
      },
      debug: process.env.NODE_ENV === 'development'
        ? {
            perSegment: segmentResults.map((r: { segmentIndex: number; fields: DetectedField[]; metadata: any }) => ({
              segmentIndex: r.segmentIndex,
              fieldsCount: r.fields.length,
            })),
          }
        : undefined,
    });
  } catch (error) {
    console.error('[Segment Detect API] Error:', error);

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
        error: 'Segment detection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
