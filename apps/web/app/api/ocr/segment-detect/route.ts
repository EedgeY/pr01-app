/**
 * Segment-based Field Detection API Route
 *
 * Orchestrates OCR and field detection for multiple segments:
 * 1. Generates PDF for each segment
 * 2. Runs OCR-only on each segment PDF
 * 3. Passes OCR result to detect-fields API
 * 4. Merges all results into unified output
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  NormalizedBBox,
  NormalizedOcr,
} from '@workspace/ai/src/ocr/types';
import type { PdfmeTextSchema } from '@workspace/ai/src/ocr';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface SegmentInput {
  pageIndex: number;
  bboxNormalized: NormalizedBBox;
  image?: string; // Base64画像データ（オプション）
}

interface SegmentResult {
  segmentIndex: number;
  fields: any[];
  pdfmeSchemas: any[];
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { segmentOcrResults } = body as {
      segmentOcrResults: Array<{
        segmentIndex: number;
        ocr: NormalizedOcr;
        image?: string; // Base64画像データ（オプション）
        pageIndex?: number;
        bboxNormalized?: NormalizedBBox;
      }>;
    };

    if (
      !segmentOcrResults ||
      !Array.isArray(segmentOcrResults) ||
      segmentOcrResults.length === 0
    ) {
      return NextResponse.json(
        { error: 'No segment OCR results provided' },
        { status: 400 }
      );
    }

    console.log(
      '[Segment Detect API] Processing',
      segmentOcrResults.length,
      'segment OCR results'
    );

    // Process each segment in parallel
    const segmentPromises = segmentOcrResults.map(
      async ({ segmentIndex, ocr, image, pageIndex, bboxNormalized }) => {
        try {
          if (
            !ocr ||
            !ocr.pages ||
            ocr.pages.length === 0 ||
            ocr.pages[0]?.blocks.length === 0
          ) {
            console.warn(
              `[Segment Detect API] Segment ${segmentIndex}: No OCR blocks found`
            );
            return {
              segmentIndex,
              fields: [],
              pdfmeSchemas: [],
              error: 'No OCR blocks found in segment',
            };
          }

          console.log(
            `[Segment Detect API] Segment ${segmentIndex}: ${ocr.pages[0]?.blocks.length} blocks, hasImage: ${Boolean(image)}`
          );

          // Call detect-fields API with OCR result and optional image
          const detectResponse = await fetch(
            `${request.nextUrl.origin}/api/ocr/detect-fields`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ocr,
                page: typeof pageIndex === 'number' ? pageIndex : 0,
                segmentIndex, // セグメント識別用
                image, // Base64画像データを渡す（存在する場合）
                segmentConstraint:
                  bboxNormalized && typeof pageIndex === 'number'
                    ? { pageIndex, bboxNormalized }
                    : undefined,
              }),
            }
          );

          if (!detectResponse.ok) {
            const errorData = await detectResponse.json();
            throw new Error(
              errorData.details || errorData.error || 'Field detection failed'
            );
          }

          const result = await detectResponse.json();

          // Prefix field names to avoid collisions
          const prefixedFields = result.fields.map((field: any) => ({
            ...field,
            name: `seg${segmentIndex}_${field.name}`,
          }));

          // Prefix schema names as well
          const prefixedSchemas = result.pdfmeSchemas.map(
            (schema: PdfmeTextSchema) => ({
              ...schema,
              name: `seg${segmentIndex}_${schema.name}`,
            })
          );

          console.log(
            `[Segment Detect API] Segment ${segmentIndex}: Detected ${prefixedFields.length} fields`
          );

          return {
            segmentIndex,
            fields: prefixedFields,
            pdfmeSchemas: prefixedSchemas,
          };
        } catch (err) {
          console.error(
            `[Segment Detect API] Segment ${segmentIndex} error:`,
            err
          );
          return {
            segmentIndex,
            fields: [],
            pdfmeSchemas: [],
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }
      }
    );

    const segmentResults: SegmentResult[] = await Promise.all(segmentPromises);

    // Merge all results
    const allFields = segmentResults.flatMap((r) => r.fields);
    const allSchemas = segmentResults.flatMap((r) => r.pdfmeSchemas);
    const errors = segmentResults
      .filter((r) => r.error)
      .map((r) => ({
        segmentIndex: r.segmentIndex,
        error: r.error,
      }));

    console.log('[Segment Detect API] Total fields:', allFields.length);
    console.log('[Segment Detect API] Total schemas:', allSchemas.length);
    if (errors.length > 0) {
      console.warn('[Segment Detect API] Errors:', errors);
    }

    return NextResponse.json({
      fields: allFields,
      pdfmeSchemas: allSchemas,
      bySegment: segmentResults,
      metadata: {
        totalSegments: segmentOcrResults.length,
        successfulSegments: segmentResults.filter((r) => !r.error).length,
        totalFields: allFields.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('[Segment Detect API] Error:', error);
    return NextResponse.json(
      {
        error: 'Segment detection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
