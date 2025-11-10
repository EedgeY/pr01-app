/**
 * Form Field Detection Agent
 *
 * Analyzes OCR output to detect form fields in Japanese government documents
 */

import { openai, defaultModel, withRetry } from '../clients/openrouter';
import {
  japaneseGovFormsSystemPrompt,
  japaneseGovFormsUserPromptTemplate,
} from './prompts/japaneseGovForms';
import type { NormalizedOcr, NormalizedBBox } from '../ocr/types';
import { extractText } from '../ocr/normalizeYomiToku';

/**
 * Detected form field
 */
export interface DetectedField {
  name: string; // 推定キー (e.g., applicant_name)
  label: string; // 表示ラベル (e.g., 氏名)
  pageIndex: number;
  bboxNormalized: NormalizedBBox;
  type: 'text' | 'date' | 'address' | 'checkbox' | 'radio' | 'number' | 'seal';
  required: boolean;
  confidence: number; // 0..1
  neighbors?: {
    left?: string;
    right?: string;
    above?: string;
    below?: string;
  };
}

/**
 * Field detection result
 */
export interface FieldDetectionResult {
  fields: DetectedField[];
  metadata: {
    totalFields: number;
    pageCount: number;
    processingTime: number;
  };
}

/**
 * Options for field detection
 */
export interface DetectFormFieldsOptions {
  /** Base64 data URL images by page index (e.g., { 0: "data:image/png;base64,..." }) */
  imagesByPage?: Record<number, string>;
  /** Page index hint for single-page detection (default: 0) */
  pageHint?: number;
}

/**
 * Detect form fields from normalized OCR
 */
export async function detectFormFields(
  ocr: NormalizedOcr,
  options?: DetectFormFieldsOptions
): Promise<FieldDetectionResult> {
  const startTime = Date.now();

  console.log(
    '[FormFieldAgent] Starting detection for',
    ocr.pages.length,
    'pages'
  );

  // OCRテキストを抽出
  const ocrText = extractText(ocr);
  console.log('[FormFieldAgent] Extracted text length:', ocrText.length);

  // レイアウト情報を構造化
  const layoutInfo = formatLayoutInfo(ocr);
  console.log('[FormFieldAgent] Layout info length:', layoutInfo.length);

  // LLMに送信
  const userPrompt = japaneseGovFormsUserPromptTemplate(ocrText, layoutInfo);
  console.log('[FormFieldAgent] User prompt length:', userPrompt.length);

  // 画像を取得（指定されたページ、なければ0ページ）
  const pageHint = options?.pageHint ?? 0;
  const imageDataUrl = options?.imagesByPage?.[pageHint];

  if (imageDataUrl) {
    console.log('[FormFieldAgent] Including image for page', pageHint);
  }

  console.log('[FormFieldAgent] Calling LLM...');
  const result = await withRetry(async () => {
    // メッセージコンテンツを構築
    const userContent: Array<{
      type: string;
      text?: string;
      image_url?: { url: string };
    }> = [{ type: 'text', text: userPrompt }];

    if (imageDataUrl) {
      userContent.push({
        type: 'image_url',
        image_url: { url: imageDataUrl },
      });
    }

    const response = await openai.chat.completions.create({
      model: defaultModel,
      messages: [
        {
          role: 'system',
          content: japaneseGovFormsSystemPrompt,
        },
        {
          role: 'user',
          content: userContent as any,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.0, // 最低温度で座標の精度と一貫性を最大化
      top_p: 1.0, // 確定的な出力のために明示的に設定
      seed: 42, // 同じ入力に対して同じ出力を保証（サポートされている場合）
    });

    const content = response.choices[0]?.message?.content;
    console.log('[FormFieldAgent] LLM response length:', content?.length);

    if (!content) throw new Error('No response from LLM');

    // マークダウンコードブロックを除去（```json...```）
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*\n?/, '');
    }
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*\n?/, '');
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(cleanedContent);
    console.log('[FormFieldAgent] Parsed result:', {
      hasFields: !!parsed.fields,
      fieldsCount: parsed.fields?.length || 0,
    });

    return parsed;
  });

  const fields: DetectedField[] = result.fields || [];
  console.log('[FormFieldAgent] Final fields count:', fields.length);

  const processingTime = Date.now() - startTime;

  return {
    fields,
    metadata: {
      totalFields: fields.length,
      pageCount: ocr.pages.length,
      processingTime,
    },
  };
}

/**
 * Format layout information for LLM
 */
function formatLayoutInfo(ocr: NormalizedOcr): string {
  const lines: string[] = [];

  for (const page of ocr.pages) {
    lines.push(`\n## ページ ${page.pageIndex + 1}`);
    lines.push(`サイズ: ${page.widthPx}x${page.heightPx}px (${page.dpi} DPI)`);

    // ブロック情報
    lines.push(`\n### テキストブロック (${page.blocks.length}個)`);
    for (let i = 0; i < page.blocks.length; i++) {
      const block = page.blocks[i];
      if (!block) continue;
      lines.push(
        `[${i}] タイプ: ${block.blockType}, 位置: (${block.bbox.x.toFixed(3)}, ${block.bbox.y.toFixed(3)}), サイズ: ${block.bbox.w.toFixed(3)}x${block.bbox.h.toFixed(3)}`
      );
      lines.push(
        `    テキスト: "${block.text.substring(0, 100)}${block.text.length > 100 ? '...' : ''}"`
      );
    }

    // 表情報
    if (page.tables && page.tables.length > 0) {
      lines.push(`\n### 表 (${page.tables.length}個)`);
      for (let i = 0; i < page.tables.length; i++) {
        const table = page.tables[i];
        if (!table) continue;
        lines.push(
          `[${i}] ${table.rows}行 x ${table.cols}列, 位置: (${table.bbox.x.toFixed(3)}, ${table.bbox.y.toFixed(3)})`
        );

        // セル情報（最初の数個のみ）
        const cellsToShow = table.cells.slice(0, 5);
        for (const cell of cellsToShow) {
          lines.push(
            `    セル[${cell.rowIndex},${cell.colIndex}]: "${cell.text.substring(0, 50)}"`
          );
        }
        if (table.cells.length > 5) {
          lines.push(`    ... (他 ${table.cells.length - 5} セル)`);
        }
      }
    }

    // 図表情報
    if (page.figures && page.figures.length > 0) {
      lines.push(`\n### 図表 (${page.figures.length}個)`);
      for (let i = 0; i < page.figures.length; i++) {
        const figure = page.figures[i];
        if (!figure) continue;
        lines.push(
          `[${i}] タイプ: ${figure.figureType}, 位置: (${figure.bbox.x.toFixed(3)}, ${figure.bbox.y.toFixed(3)})`
        );
      }
    }

    // 読み順
    if (page.readingOrder) {
      lines.push(`\n### 読み順: [${page.readingOrder.join(', ')}]`);
    }
  }

  return lines.join('\n');
}

/**
 * Validate and filter detected fields
 */
export function validateFields(fields: DetectedField[]): DetectedField[] {
  return fields.filter((field) => {
    // 基本的な検証
    if (!field.name || !field.label) return false;
    if (field.confidence < 0.3) return false; // 低信頼度を除外

    // bbox検証
    const bbox = field.bboxNormalized;
    if (
      bbox.x < 0 ||
      bbox.y < 0 ||
      bbox.w <= 0 ||
      bbox.h <= 0 ||
      bbox.x + bbox.w > 1 ||
      bbox.y + bbox.h > 1
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Group fields by page
 */
export function groupFieldsByPage(
  fields: DetectedField[]
): Map<number, DetectedField[]> {
  const grouped = new Map<number, DetectedField[]>();

  for (const field of fields) {
    const pageFields = grouped.get(field.pageIndex) || [];
    pageFields.push(field);
    grouped.set(field.pageIndex, pageFields);
  }

  return grouped;
}

/**
 * Sort fields by reading order (top to bottom, left to right)
 */
export function sortFieldsByReadingOrder(
  fields: DetectedField[]
): DetectedField[] {
  return [...fields].sort((a, b) => {
    // まずページ順
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }

    // 次にY座標（上から下）
    const yDiff = a.bboxNormalized.y - b.bboxNormalized.y;
    if (Math.abs(yDiff) > 0.01) {
      return yDiff;
    }

    // 最後にX座標（左から右）
    return a.bboxNormalized.x - b.bboxNormalized.x;
  });
}
