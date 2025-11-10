/**
 * OCR Integration Examples
 * 
 * Complete examples showing how to use the OCR system
 */

import type {
  NormalizedOcr,
  NormalizedPage,
  DetectedField,
} from '../types';
import {
  normalizeOcrResponse,
  extractText,
  chunkOcrForLLM,
  fromNormalized,
} from '../index';

/**
 * Example 1: Basic OCR Processing
 */
export async function basicOcrExample(file: File) {
  // Step 1: Upload to OCR service
  const formData = new FormData();
  formData.append('file', file);
  formData.append('dpi', '300');
  formData.append('device', 'cuda');

  const ocrResponse = await fetch('/api/ocr', {
    method: 'POST',
    body: formData,
  });

  const ocr: NormalizedOcr = await ocrResponse.json();

  // Step 2: Extract text
  const fullText = extractText(ocr);
  console.log('Extracted text:', fullText);

  // Step 3: Access page details
  for (const page of ocr.pages) {
    console.log(`Page ${page.pageIndex + 1}:`);
    console.log(`  Size: ${page.widthPx}x${page.heightPx} (${page.dpi} DPI)`);
    console.log(`  Blocks: ${page.blocks.length}`);
    console.log(`  Tables: ${page.tables?.length || 0}`);
  }

  return ocr;
}

/**
 * Example 2: Form Field Detection
 */
export async function formFieldDetectionExample(ocr: NormalizedOcr) {
  // Call field detection API
  const response = await fetch('/api/fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ocr }),
  });

  const result = await response.json();
  const fields: DetectedField[] = result.fields;

  // Process detected fields
  console.log(`Detected ${fields.length} fields:`);
  
  for (const field of fields) {
    console.log(`\n${field.label} (${field.name}):`);
    console.log(`  Type: ${field.type}`);
    console.log(`  Required: ${field.required}`);
    console.log(`  Confidence: ${(field.confidence * 100).toFixed(1)}%`);
    console.log(`  Position: (${field.bboxNormalized.x.toFixed(3)}, ${field.bboxNormalized.y.toFixed(3)})`);
  }

  return fields;
}

/**
 * Example 3: Drawing BBoxes on Canvas
 */
export function drawBBoxesExample(
  canvas: HTMLCanvasElement,
  page: NormalizedPage,
  fields: DetectedField[],
  imageUrl: string
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  img.onload = () => {
    // Set canvas size to match image
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Draw text blocks (blue)
    ctx.strokeStyle = 'rgba(0, 100, 255, 0.5)';
    ctx.lineWidth = 2;
    for (const block of page.blocks) {
      const bbox = fromNormalized(block.bbox, img.width, img.height);
      ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
    }

    // Draw detected fields (red)
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';

    const pageFields = fields.filter((f) => f.pageIndex === page.pageIndex);
    for (const field of pageFields) {
      const bbox = fromNormalized(field.bboxNormalized, img.width, img.height);
      ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
      ctx.fillText(field.label, bbox.x, bbox.y - 5);
    }
  };
  img.src = imageUrl;
}

/**
 * Example 4: Chunking for LLM Processing
 */
export function chunkingExample(ocr: NormalizedOcr) {
  // Split large documents into chunks
  const chunks = chunkOcrForLLM(ocr, 4000);

  console.log(`Document split into ${chunks.length} chunks:`);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`\nChunk ${i + 1}:`);
    console.log(`  Pages: ${chunk.pages.map((p) => p.pageIndex + 1).join(', ')}`);
    console.log(`  Estimated tokens: ${chunk.estimatedTokens}`);
    console.log(`  Text preview: ${chunk.text.substring(0, 100)}...`);
  }

  return chunks;
}

/**
 * Example 5: Finding Fields by Type
 */
export function findFieldsByTypeExample(
  fields: DetectedField[],
  type: DetectedField['type']
) {
  const filtered = fields.filter((f) => f.type === type);
  
  console.log(`Found ${filtered.length} ${type} fields:`);
  for (const field of filtered) {
    console.log(`  - ${field.label} (${field.name})`);
  }

  return filtered;
}

/**
 * Example 6: Grouping Fields by Page
 */
export function groupFieldsByPageExample(fields: DetectedField[]) {
  const grouped = new Map<number, DetectedField[]>();

  for (const field of fields) {
    const pageFields = grouped.get(field.pageIndex) || [];
    pageFields.push(field);
    grouped.set(field.pageIndex, pageFields);
  }

  console.log('Fields grouped by page:');
  for (const [pageIndex, pageFields] of grouped.entries()) {
    console.log(`  Page ${pageIndex + 1}: ${pageFields.length} fields`);
  }

  return grouped;
}

/**
 * Example 7: Complete Workflow
 */
export async function completeWorkflowExample(file: File) {
  console.log('=== Complete OCR Workflow ===\n');

  // Step 1: OCR
  console.log('Step 1: Running OCR...');
  const ocr = await basicOcrExample(file);

  // Step 2: Field Detection
  console.log('\nStep 2: Detecting form fields...');
  const fields = await formFieldDetectionExample(ocr);

  // Step 3: Analysis
  console.log('\nStep 3: Analyzing results...');
  
  // Group by type
  const textFields = findFieldsByTypeExample(fields, 'text');
  const dateFields = findFieldsByTypeExample(fields, 'date');
  const checkboxFields = findFieldsByTypeExample(fields, 'checkbox');

  // Group by page
  const fieldsByPage = groupFieldsByPageExample(fields);

  // Step 4: Generate output
  console.log('\nStep 4: Generating output...');
  const output = {
    metadata: ocr.metadata,
    pages: ocr.pages.length,
    totalFields: fields.length,
    fieldsByType: {
      text: textFields.length,
      date: dateFields.length,
      checkbox: checkboxFields.length,
    },
    fieldsByPage: Array.from(fieldsByPage.entries()).map(
      ([pageIndex, pageFields]) => ({
        page: pageIndex + 1,
        count: pageFields.length,
      })
    ),
  };

  console.log('\nFinal output:', JSON.stringify(output, null, 2));

  return { ocr, fields, output };
}




