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
 * Generate appropriate placeholder text based on field type and label
 *
 * @param field - Detected form field
 * @returns Placeholder text suitable for the field
 */
export function generatePlaceholder(field: DetectedField): string {
  const label = field.label.toLowerCase();

  // Type-based placeholders
  switch (field.type) {
    case 'date':
      return '令和6年1月1日';
    case 'number':
      return '0';
    case 'checkbox':
      return '☑';
    case 'radio':
      return '◉';
    case 'seal':
      return '印';
    case 'address':
      return '東京都渋谷区○○1-2-3';
  }

  // Label-based placeholders for text fields
  if (label.includes('氏名') || label.includes('名前')) {
    if (label.includes('フリガナ') || label.includes('ふりがな')) {
      return 'ヤマダ タロウ';
    }
    return '山田 太郎';
  }

  if (label.includes('住所') || label.includes('所在地')) {
    return '東京都渋谷区○○1-2-3';
  }

  if (label.includes('電話') || label.includes('tel')) {
    if (label.includes('携帯')) {
      return '090-1234-5678';
    }
    return '03-1234-5678';
  }

  if (
    label.includes('メール') ||
    label.includes('mail') ||
    label.includes('email')
  ) {
    return 'example@example.com';
  }

  if (label.includes('郵便') || label.includes('〒')) {
    return '150-0001';
  }

  if (label.includes('年齢')) {
    return '30';
  }

  if (label.includes('性別')) {
    return '男性';
  }

  if (label.includes('生年月日') || label.includes('誕生日')) {
    return '平成5年4月1日';
  }

  if (
    label.includes('会社') ||
    label.includes('企業') ||
    label.includes('法人')
  ) {
    return '株式会社○○';
  }

  if (label.includes('部署') || label.includes('所属')) {
    return '営業部';
  }

  if (label.includes('役職') || label.includes('肩書')) {
    return '部長';
  }

  if (
    label.includes('金額') ||
    label.includes('料金') ||
    label.includes('価格')
  ) {
    return '10,000円';
  }

  if (label.includes('口座')) {
    if (label.includes('番号')) {
      return '1234567';
    }
    if (label.includes('名義')) {
      return 'ヤマダ タロウ';
    }
    return '普通';
  }

  if (label.includes('銀行')) {
    return '○○銀行';
  }

  if (label.includes('支店')) {
    return '○○支店';
  }

  if (
    label.includes('備考') ||
    label.includes('コメント') ||
    label.includes('特記')
  ) {
    return '特になし';
  }

  // Default placeholder
  return field.label;
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
  return fields.map((field) => {
    const placeholder = generatePlaceholder(field);
    const schema = bboxToTextSchema(
      field.bboxNormalized,
      placeholder,
      field.name || field.label,
      page
    );

    // Set required flag from field
    schema.required = field.required;

    return schema;
  });
}
