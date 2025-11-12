/**
 * pdfme スキーマ変換ユーティリティ（pdfme Schema Conversion）
 *
 * OCRで検出したバウンディングボックスやフィールド情報を、
 * pdfmeライブラリで使用可能なTextSchemaフォーマットに変換します。
 *
 * ## 概要
 *
 * このモジュールは、OCR処理とPDF編集の橋渡しを行います。
 *
 * **処理フロー:**
 * ```
 * OCR検出結果                pdfme変換                PDF編集可能
 * (正規化座標)      →     (mm単位座標)      →      (フォーム入力)
 *
 * NormalizedBBox    →    PdfmeTextSchema    →     入力可能なPDF
 * { x: 0.1,              { position:              フィールド
 *   y: 0.2,                { x: 21mm,
 *   w: 0.3,                  y: 59.4mm },
 *   h: 0.05 }              width: 63mm,
 *                          height: 14.85mm }
 * ```
 *
 * ## pdfme とは
 *
 * pdfme（https://pdfme.com/）は、TypeScript/JavaScriptでPDFを生成・編集できる
 * オープンソースライブラリです。特にフォーム入力可能なPDFの作成に特化しています。
 *
 * **主な用途:**
 * - OCR結果から入力可能なPDFテンプレートを生成
 * - 検出したフィールド位置にテキストボックスを配置
 * - ユーザーがブラウザ上でフォーム入力できるPDFを作成
 *
 * ## 座標系変換
 *
 * ### 正規化座標 → mm座標
 *
 * ```
 * 正規化座標（DPI非依存、[0,1]範囲）
 *     ↓ × ページサイズ（mm）
 * 物理座標（mm単位）
 *
 * 例：A4縦（210×297mm）の場合
 * x: 0.1 → 0.1 × 210mm = 21mm
 * y: 0.2 → 0.2 × 297mm = 59.4mm
 * w: 0.3 → 0.3 × 210mm = 63mm
 * h: 0.05 → 0.05 × 297mm = 14.85mm
 * ```
 *
 * ### サポートする用紙サイズ
 *
 * デフォルトはA4縦（210×297mm）ですが、任意のサイズを指定可能：
 * - A4縦: 210×297mm（デフォルト）
 * - A4横: 297×210mm
 * - A3縦: 297×420mm
 * - B5縦: 182×257mm
 * - レター: 215.9×279.4mm
 *
 * ## PdfmeTextSchema フォーマット
 *
 * pdfmeが要求するスキーマの構造：
 *
 * ```typescript
 * {
 *   name: string;              // フィールド識別子（一意）
 *   type: 'text';              // フィールドタイプ
 *   content: string;           // デフォルト値またはプレースホルダー
 *   position: { x, y };        // 左上座標（mm）
 *   width: number;             // 幅（mm）
 *   height: number;            // 高さ（mm）
 *   fontSize: number;          // フォントサイズ（pt）
 *   fontName: string;          // フォント名（'NotoSerifJP'等）
 *   alignment: 'left'|...;     // 水平配置
 *   verticalAlignment: ...;    // 垂直配置
 *   dynamicFontSize: {...};    // 動的フォントサイズ調整
 *   // ...その他のスタイル設定
 * }
 * ```
 *
 * ## 主な機能
 *
 * ### 基本変換
 * - `bboxToTextSchema()`: 単一bboxをTextSchemaに変換
 *   - 正規化座標をmm単位に変換
 *   - デフォルトのスタイル設定を適用
 *   - 日本語フォント（NotoSerifJP）を使用
 *
 * - `manyBboxesToTextSchemas()`: 複数bboxを一括変換
 *   - 各bboxに一意な名前を自動付与（field1, field2...）
 *   - オプションでカスタム名を指定可能
 *
 * ### フィールド検出結果の変換
 * - `fieldsToTextSchemas()`: DetectedField配列をTextSchemaに変換
 *   - フィールドタイプに応じた設定
 *   - セグメント化されたフィールドに対応
 *   - 必須フィールドのマーク付け
 *
 * ### プレースホルダー生成
 * - `generatePlaceholder()`: フィールドに適したプレースホルダーを生成
 *   - フィールドタイプに基づく適切な例示値
 *   - ラベルテキストからの推測
 *   - 日本の様式に準拠した例（住所、電話番号、日付など）
 *
 * ## プレースホルダーの例
 *
 * | フィールドタイプ | ラベル例 | プレースホルダー |
 * |-----------------|---------|----------------|
 * | 氏名 | 氏名、名前 | 山田 太郎 |
 * | フリガナ | フリガナ | ヤマダ タロウ |
 * | 住所 | 住所、所在地 | 東京都渋谷区○○1-2-3 |
 * | 電話 | 電話番号 | 03-1234-5678 |
 * | 携帯 | 携帯電話 | 090-1234-5678 |
 * | メール | メールアドレス | example@example.com |
 * | 郵便番号 | 郵便番号、〒 | 150-0001 |
 * | 日付 | 日付、年月日 | 令和6年1月1日 |
 * | 生年月日 | 生年月日 | 平成5年4月1日 |
 * | 会社名 | 会社名 | 株式会社○○ |
 * | 金額 | 金額、料金 | 10,000円 |
 * | 印鑑 | 印 | 印 |
 * | チェックボックス | - | ☑ |
 *
 * ## 使用例
 *
 * ```typescript
 * // 1. 基本的なbbox変換
 * const bbox = { x: 0.1, y: 0.2, w: 0.3, h: 0.05 };
 * const schema = bboxToTextSchema(bbox, 'name_field');
 * // → pdfmeで使用可能なTextSchemaオブジェクト
 *
 * // 2. OCR検出結果からのフォーム生成
 * const ocrBlocks = normalizedOcr.pages[0].blocks;
 * const schemas = manyBboxesToTextSchemas(
 *   ocrBlocks.map((block, i) => ({
 *     bbox: block.bbox,
 *     text: block.text,
 *     name: `field_${i}`
 *   }))
 * );
 *
 * // 3. AI検出フィールドからのテンプレート生成
 * const detectedFields: DetectedField[] = await detectFormFields(ocr);
 * const schemas = fieldsToTextSchemas(detectedFields);
 *
 * // 4. pdfmeでPDF生成
 * import { generate } from '@pdfme/generator';
 * const pdf = await generate({
 *   template: {
 *     schemas: [schemas],  // ← 変換したスキーマを使用
 *     basePdf: originalPdfBuffer,
 *   },
 *   inputs: [{ name_field: '山田太郎' }],
 * });
 *
 * // 5. カスタム用紙サイズ（A3横）
 * const schema = bboxToTextSchema(
 *   bbox,
 *   'field1',
 *   { width: 420, height: 297 }  // A3横
 * );
 * ```
 *
 * ## セグメント化フィールドの処理
 *
 * 長い入力欄が複数の下線セグメントに分かれている場合：
 *
 * ```
 * 氏名：＿＿＿＿＿ ＿＿＿＿＿
 *      ↑seg1     ↑seg2
 * ```
 *
 * `fieldsToTextSchemas()`は自動的に各セグメントを個別のスキーマに変換：
 * - `name_lastName` (セグメント1)
 * - `name_firstName` (セグメント2)
 *
 * ## 動的フォントサイズ
 *
 * すべてのフィールドに動的フォントサイズ調整を設定：
 *
 * ```typescript
 * dynamicFontSize: {
 *   min: 6,          // 最小サイズ（pt）
 *   max: 13,         // 最大サイズ（pt）
 *   fit: 'horizontal' // 横幅に合わせる
 * }
 * ```
 *
 * これにより、長いテキストが入力されてもフィールドからはみ出さず、
 * 自動的にフォントサイズが縮小されます。
 *
 * ## A4サイズの定数
 *
 * ```typescript
 * export const A4_PORTRAIT_MM = { width: 210, height: 297 };
 * ```
 *
 * よく使うA4縦サイズを定数として提供しています。
 *
 * ## 設計思想
 *
 * - **変換の単純化**: OCR座標からpdfme形式への直接変換を提供
 * - **日本語対応**: 日本の様式（住所、日付表記など）に最適化
 * - **柔軟性**: 任意の用紙サイズに対応
 * - **UX重視**: 適切なプレースホルダーで入力しやすい
 * - **オーバーフロー防止**: 動的フォントサイズで見栄えを保つ
 *
 * ## pdfmeとの連携
 *
 * このモジュールは以下のpdfmeパッケージと組み合わせて使用します：
 *
 * - `@pdfme/generator`: PDFを生成
 * - `@pdfme/ui`: ブラウザ上でPDFを編集可能なUIを提供
 * - `@pdfme/schemas`: テキスト以外のスキーマタイプ（画像、バーコードなど）
 *
 * ## 制限事項
 *
 * - 現在は`text`タイプのみサポート（チェックボックス、画像は別途実装が必要）
 * - 回転（rotate）は常に0（将来的に対応可能）
 * - 複数ページのPDFでは、ページごとにスキーマ配列が必要
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
 * @param name - Field name/identifier
 * @param page - Page dimensions in mm (default: A4 portrait)
 * @returns pdfme TextSchema object with position/size in mm
 */
export function bboxToTextSchema(
  bbox: { x: number; y: number; w: number; h: number },
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
    content: '',
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
    bboxToTextSchema(it.bbox, it.name ?? `field${i + 1}`, page)
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
  segments?: Array<{
    name: string;
    bboxNormalized: { x: number; y: number; w: number; h: number };
    placeholder?: string;
  }>;
  uiHint?: 'underlineSegments' | 'bracketed' | 'grouped' | 'tableCell' | 'free';
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
  const results: PdfmeTextSchema[] = [];

  for (const field of fields) {
    // セグメント化されたフィールドは各セグメントごとにスキーマ化
    if (field.segments && field.segments.length > 0) {
      for (const seg of field.segments) {
        const schema = bboxToTextSchema(
          seg.bboxNormalized,
          `${field.name}_${seg.name}`,
          page
        );
        schema.required = false; // Always set to false for pdfme schemas
        // 下線入力の見栄えを多少良くするためのヒント（下線は PDF 側にある前提）
        schema.underline = false;
        results.push(schema);
      }
      continue;
    }

    // 通常フィールド
    const schema = bboxToTextSchema(
      field.bboxNormalized,
      field.name || field.label,
      page
    );
    schema.required = false; // Always set to false for pdfme schemas
    results.push(schema);
  }

  return results;
}
