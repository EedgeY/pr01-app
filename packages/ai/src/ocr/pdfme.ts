/**
 * pdfme TextSchema conversion utilities
 *
 * Converts normalized OCR bboxes to pdfme TextSchema format.
 * Assumes A4 portrait (210×297mm) by default.
 */

/**
 * A4 portrait page size in millimeters
 */
export const A4_PORTRAIT_MM = { width: 210, height: 297 } as const;

/**
 * pdfme TextSchema type definition
 * Based on: https://github.com/pdfme/pdfme/blob/main/packages/schemas/src/text/types.ts
 */
export type PdfmeTextSchema = {
  name: string;
  type: 'text';
  content: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  rotate: 0;
  alignment: 'left' | 'center' | 'right' | 'justify';
  verticalAlignment: 'top' | 'middle' | 'bottom';
  fontSize: number;
  lineHeight: number;
  characterSpacing: number;
  fontColor: string;
  fontName?: string;
  backgroundColor: string;
  opacity: number;
  strikethrough?: boolean;
  underline?: boolean;
  required?: boolean;
  dynamicFontSize?: {
    min: number;
    max: number;
    fit: 'horizontal' | 'vertical';
  };
};

/**
 * Convert a normalized bbox to pdfme TextSchema
 *
 * @param bbox - Normalized bbox [0..1] with top-left origin
 * @param content - Text content for the field
 * @param name - Field name/identifier
 * @param page - Page dimensions in mm (default: A4 portrait)
 * @returns pdfme TextSchema object with position/size in mm
 */
export function bboxToTextSchema(
  bbox: { x: number; y: number; w: number; h: number },
  content: string,
  name = 'field',
  page: { width: number; height: number } = A4_PORTRAIT_MM
): PdfmeTextSchema {
  // Convert normalized coordinates to millimeters
  const x = bbox.x * page.width;
  const y = bbox.y * page.height;
  const width = bbox.w * page.width;
  const height = bbox.h * page.height;

  return {
    name,
    type: 'text',
    content: content || 'Type Something...',
    position: { x, y },
    width,
    height,
    rotate: 0,
    alignment: 'left',
    verticalAlignment: 'top',
    fontSize: 13,
    lineHeight: 1,
    characterSpacing: 0,
    fontColor: '#000000',
    fontName: 'NotoSerifJP',
    backgroundColor: '',
    opacity: 1,
    strikethrough: false,
    underline: false,
    required: false,
    // Enable dynamic font sizing to prevent overflow
    dynamicFontSize: { min: 6, max: 13, fit: 'horizontal' },
  };
}

/**
 * Convert multiple bboxes to pdfme TextSchema array
 *
 * @param items - Array of bbox+text items
 * @param page - Page dimensions in mm (default: A4 portrait)
 * @returns Array of pdfme TextSchema objects
 */
export function manyBboxesToTextSchemas(
  items: Array<{
    bbox: { x: number; y: number; w: number; h: number };
    text: string;
    name?: string;
  }>,
  page: { width: number; height: number } = A4_PORTRAIT_MM
): PdfmeTextSchema[] {
  return items.map((it, i) =>
    bboxToTextSchema(it.bbox, it.text, it.name ?? `field${i + 1}`, page)
  );
}

/**
 * DetectedField type (imported from formFieldAgent)
 */
export interface DetectedField {
  name: string;
  label: string;
  pageIndex: number;
  bboxNormalized: { x: number; y: number; w: number; h: number };
  type: 'text' | 'date' | 'address' | 'checkbox' | 'radio' | 'number' | 'seal';
  required: boolean;
  confidence: number;
}

/**
 * Convert DetectedField array to pdfme TextSchema array
 *
 * @param fields - Array of detected form fields
 * @param page - Page dimensions in mm (default: A4 portrait)
 * @returns Array of pdfme TextSchema objects
 */
export function fieldsToTextSchemas(
  fields: DetectedField[],
  page: { width: number; height: number } = A4_PORTRAIT_MM
): PdfmeTextSchema[] {
  return fields.map((field) =>
    bboxToTextSchema(
      field.bboxNormalized,
      '', // Empty content - user will fill in
      field.name || field.label,
      page
    )
  );
}
