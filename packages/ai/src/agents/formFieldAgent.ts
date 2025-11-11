/**
 * Form Field Detection Agent
 *
 * Analyzes OCR output to detect form fields in Japanese government documents
 */

import { openai, defaultModel, withRetry } from '../clients/openrouter';
import {
  japaneseGovFormsSystemPrompt,
  japaneseGovFormsUserPromptTemplate,
  japaneseGovFormsTwoSourcePromptTemplate,
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
  /**
   * レイアウト適合のための細分化された入力セグメント。
   * 例）日付欄の「年」「月」「日」、郵便番号の「3桁」「4桁」など。
   * セグメントが存在する場合、bboxNormalized は親グループ全体の外接矩形、
   * segments の各bboxNormalized が個別の入力位置を表す。
   */
  segments?: Array<{
    name: string; // 例: year, month, day, zip3, zip4, era
    bboxNormalized: NormalizedBBox;
    placeholder?: string;
  }>;
  /**
   * UIレンダリングのヒント。下線上入力・括弧内入力・グループ入力など。
   */
  uiHint?: 'underlineSegments' | 'bracketed' | 'grouped' | 'tableCell' | 'free';
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
  /**
   * セグメント制約: 指定された場合、出力bboxはこの範囲に完全に収まるように制限される
   * 座標はページ全体に対する正規化座標 [0,1]
   */
  segmentConstraint?: {
    pageIndex: number;
    bboxNormalized: NormalizedBBox;
  };
  /**
   * text-only OCR結果（文字認識に特化）
   * 指定された場合、textOcrとlayoutOcrの2ソースモードで検出を実行
   */
  textOcr?: NormalizedOcr;
  /**
   * layout-only OCR結果（レイアウト解析に特化）
   * 指定された場合、textOcrとlayoutOcrの2ソースモードで検出を実行
   */
  layoutOcr?: NormalizedOcr;
}

/**
 * Detect form fields from normalized OCR
 *
 * @param ocr - 統合OCR結果（後方互換性のため保持、textOcr/layoutOcrが指定されていない場合に使用）
 * @param options - 検出オプション（画像、2ソースOCRなど）
 */
export async function detectFormFields(
  ocr: NormalizedOcr,
  options?: DetectFormFieldsOptions
): Promise<FieldDetectionResult> {
  const startTime = Date.now();

  // 2ソースモード（textOcr + layoutOcr）か単一ソースモードかを判定
  const useTwoSourceMode = !!(options?.textOcr && options?.layoutOcr);

  if (useTwoSourceMode) {
    console.log(
      '[FormFieldAgent] Using TWO-SOURCE mode (text-only + layout-only)'
    );
    console.log(
      '[FormFieldAgent] Text OCR pages:',
      options.textOcr!.pages.length
    );
    console.log(
      '[FormFieldAgent] Layout OCR pages:',
      options.layoutOcr!.pages.length
    );
  } else {
    console.log('[FormFieldAgent] Using SINGLE-SOURCE mode (unified OCR)');
    console.log(
      '[FormFieldAgent] Starting detection for',
      ocr.pages.length,
      'pages'
    );
  }

  // プロンプト構築
  let userPrompt: string;

  if (useTwoSourceMode) {
    // 2ソースモード: text-only と layout-only を分離して提示
    const textOcrText = extractText(options.textOcr!);
    const layoutInfo = formatLayoutInfo(options.layoutOcr!);

    console.log('[FormFieldAgent] Text OCR text length:', textOcrText.length);
    console.log('[FormFieldAgent] Layout info length:', layoutInfo.length);

    userPrompt = japaneseGovFormsTwoSourcePromptTemplate(
      textOcrText,
      layoutInfo
    );
  } else {
    // 単一ソースモード: 従来通り
    const ocrText = extractText(ocr);
    const layoutInfo = formatLayoutInfo(ocr);

    console.log('[FormFieldAgent] Extracted text length:', ocrText.length);
    console.log('[FormFieldAgent] Layout info length:', layoutInfo.length);

    userPrompt = japaneseGovFormsUserPromptTemplate(ocrText, layoutInfo);
  }

  // セグメント制約がある場合、ユーザープロンプトに厳格な範囲制約を付与
  if (options?.segmentConstraint) {
    const seg = options.segmentConstraint;
    const sx = seg.bboxNormalized.x.toFixed(3);
    const sy = seg.bboxNormalized.y.toFixed(3);
    const sw = seg.bboxNormalized.w.toFixed(3);
    const sh = seg.bboxNormalized.h.toFixed(3);
    userPrompt += `

# セグメント制約（厳守）
- 対象ページ: ${seg.pageIndex}
- セグメントbboxNormalized: (x:${sx}, y:${sy}, w:${sw}, h:${sh})
- すべての出力フィールドのbboxNormalizedは、このセグメント矩形に**完全に収まる**こと。
  - x >= seg.x, y >= seg.y
  - x + w <= seg.x + seg.w
  - y + h <= seg.y + seg.h
- 特に幅(w)は**seg.w以下**に制限すること（セグメントの外へはみ出す幅を生成しない）。
- 親フィールドのsegmentsを出力する場合も、各segmentのbboxNormalizedをこの範囲内に**必ず**制限すること。
- 不明な場合はセグメント内の空白・罫線・括弧・表セルの要素のみに限定して検出せよ。`;
  }

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
      temperature: 0.1, // 最低温度で座標の精度と一貫性を最大化
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

  // 返却フィールド
  let fields: DetectedField[] = result.fields || [];
  console.log('[FormFieldAgent] Final fields count:', fields.length);

  // セグメント制約がある場合、出力bboxをセグメント範囲にクリップ（はみ出し防止の最終防衛線）
  if (options?.segmentConstraint) {
    const seg = options.segmentConstraint;
    fields = fields
      .map((field) => clampFieldToSegment(field, seg))
      .filter((field) => isFieldInsideSegment(field, seg));
  }

  const processingTime = Date.now() - startTime;

  // ページ数は2ソースモードの場合はlayoutOcrを優先、なければocr
  const pageCount = useTwoSourceMode
    ? options.layoutOcr!.pages.length
    : ocr.pages.length;

  return {
    fields,
    metadata: {
      totalFields: fields.length,
      pageCount,
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
 * フィールドbboxおよび子segmentsのbboxをセグメント範囲にクリップする
 */
function clampFieldToSegment(
  field: DetectedField,
  seg: { pageIndex: number; bboxNormalized: NormalizedBBox }
): DetectedField {
  const clampedFieldBbox = clampBBoxToSegment(field.bboxNormalized, seg.bboxNormalized);
  const clampedSegments =
    field.segments?.map((s) => ({
      ...s,
      bboxNormalized: clampBBoxToSegment(s.bboxNormalized, seg.bboxNormalized),
    })) ?? field.segments;

  return {
    ...field,
    bboxNormalized: clampedFieldBbox,
    segments: clampedSegments,
  };
}

/**
 * bboxをセグメント矩形にクリップする（正規化座標 [0,1]）
 */
function clampBBoxToSegment(
  bbox: NormalizedBBox,
  segBBox: NormalizedBBox
): NormalizedBBox {
  const segRight = segBBox.x + segBBox.w;
  const segBottom = segBBox.y + segBBox.h;
  const right = bbox.x + bbox.w;
  const bottom = bbox.y + bbox.h;

  const x = Math.max(bbox.x, segBBox.x);
  const y = Math.max(bbox.y, segBBox.y);
  const x2 = Math.min(right, segRight);
  const y2 = Math.min(bottom, segBottom);

  const w = Math.max(0, x2 - x);
  const h = Math.max(0, y2 - y);

  return { x, y, w, h };
}

/**
 * フィールドがセグメント範囲内に実質的に収まっているかを確認
 */
function isFieldInsideSegment(
  field: DetectedField,
  seg: { pageIndex: number; bboxNormalized: NormalizedBBox }
): boolean {
  const b = field.bboxNormalized;
  const s = seg.bboxNormalized;
  if (b.w <= 0 || b.h <= 0) return false;
  const withinX = b.x >= s.x && b.x + b.w <= s.x + s.w;
  const withinY = b.y >= s.y && b.y + b.h <= s.y + s.h;
  return withinX && withinY;
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
