/**
 * YomiToku OCR出力の正規化（Normalization）
 *
 * YomiToku OCRエンジンからの生出力を、DPI非依存の正規化されたスキーマに変換します。
 * 異なるOCRエンジンからの出力を統一された形式で扱えるようにする抽象化レイヤーです。
 * 
 * ## 概要
 * 
 * このモジュールは、以下の2つの主要な役割を果たします：
 * 
 * 1. **データ正規化**: OCRエンジン固有の出力形式を、システム標準の正規化形式に変換
 * 2. **座標系変換**: ピクセル座標を正規化座標（[0,1]範囲）に変換し、DPI非依存性を実現
 * 
 * ## 正規化プロセス
 * 
 * ### 入力（RawOcrResponse）
 * - OCRエンジンから直接返される生データ
 * - ピクセル単位の絶対座標（DPI依存）
 * - エンジン固有のデータ構造
 * 
 * ### 出力（NormalizedOcr）
 * - 正規化座標系（[0,1]範囲、DPI非依存）
 * - 統一されたデータ構造
 * - メタデータ（処理時間、モデル名など）を含む
 * 
 * ## データ階層構造
 * 
 * ```
 * NormalizedOcr
 * └── pages[]                    # ページ配列
 *     ├── pageIndex              # ページ番号
 *     ├── dpi                    # 解像度情報
 *     ├── widthPx, heightPx      # 元画像サイズ（参考値）
 *     ├── blocks[]               # テキストブロック配列
 *     │   ├── text               # ブロック全体のテキスト
 *     │   ├── bbox               # 正規化バウンディングボックス
 *     │   ├── blockType          # ブロックタイプ（段落、見出しなど）
 *     │   └── lines[]            # 行配列
 *     │       ├── text           # 行のテキスト
 *     │       ├── bbox           # 正規化bbox
 *     │       └── tokens[]       # トークン（単語）配列
 *     │           ├── text       # トークンのテキスト
 *     │           ├── bbox       # 正規化bbox
 *     │           └── confidence # 信頼度スコア
 *     ├── tables[]               # テーブル配列（オプション）
 *     │   ├── bbox               # テーブル全体のbbox
 *     │   ├── rows, cols         # 行数・列数
 *     │   └── cells[]            # セル配列
 *     │       ├── rowIndex, colIndex
 *     │       ├── rowSpan, colSpan
 *     │       ├── text
 *     │       └── bbox
 *     ├── figures[]              # 図形配列（オプション）
 *     │   ├── bbox
 *     │   └── figureType
 *     └── readingOrder[]         # 読み順インデックス配列
 * ```
 * 
 * ## 主要な関数
 * 
 * ### 正規化
 * - `normalizeOcrResponse()`: OCRレスポンス全体を正規化
 * - `normalizePage()`: 単一ページの正規化（内部関数）
 * 
 * ### テキスト抽出
 * - `extractText()`: 全ページから読み順に従ってテキストを抽出
 * - `extractPageText()`: 特定ページからテキストを抽出
 * 
 * ### 空間検索・解析
 * - `findNearbyBlocks()`: 指定bbox近くのブロックを検索
 *   - フォームフィールドのラベル検出などに使用
 * - `groupBlocksByRow()`: ブロックを垂直位置でグループ化
 *   - フォームの行構造を解析するのに有用
 * 
 * ### LLM連携
 * - `chunkOcrForLLM()`: OCRコンテンツをLLM処理用にチャンク分割
 *   - トークン制限を考慮した分割
 *   - ページ境界を尊重した分割
 * - `estimateTokens()`: テキストのトークン数を概算
 * 
 * ## 使用例
 * 
 * ```typescript
 * // 基本的な正規化
 * const rawOcr = await yomitokuClient.processDocument(pdfBuffer);
 * const normalized = normalizeOcrResponse(rawOcr, 'yomitoku');
 * 
 * // 全テキストを抽出
 * const fullText = extractText(normalized);
 * 
 * // フィールドラベルの検出
 * const fieldBbox = { x: 0.1, y: 0.2, w: 0.3, h: 0.05 };
 * const nearbyBlocks = findNearbyBlocks(
 *   normalized.pages[0],
 *   fieldBbox,
 *   0.05  // 最大距離（正規化単位）
 * );
 * 
 * // LLM処理用のチャンク分割
 * const chunks = chunkOcrForLLM(normalized, 4000);
 * for (const chunk of chunks) {
 *   const result = await llm.process(chunk.text);
 * }
 * 
 * // フォーム行の解析
 * const page = normalized.pages[0];
 * const rows = groupBlocksByRow(page.blocks, 0.01);
 * ```
 * 
 * ## 設計思想
 * 
 * - **OCRエンジン非依存**: 異なるOCRエンジン（YomiToku、Google Vision、Azure等）
 *   からの出力を同じインターフェースで扱える
 * - **DPI非依存**: 正規化座標により、画像解像度に依存しない処理が可能
 * - **レイアウト保持**: 読み順や空間的な位置関係を保持し、文書構造を理解可能
 * - **LLMフレンドリー**: トークン制限を考慮したチャンク分割機能を提供
 * - **拡張性**: テーブル、図形などの追加要素もサポート
 * 
 * ## パフォーマンス考慮事項
 * 
 * - 座標変換は軽量な算術演算のみで高速
 * - 大規模文書は`chunkOcrForLLM()`で適切に分割してメモリ効率を保つ
 * - `groupBlocksByRow()`や`findNearbyBlocks()`は O(n) または O(n log n) の計算量
 */

import type {
  NormalizedOcr,
  NormalizedPage,
  NormalizedBlock,
  NormalizedLine,
  NormalizedToken,
  NormalizedTable,
  NormalizedFigure,
  RawOcrResponse,
} from './types';
import { toNormalized } from './geometry';

/**
 * Normalize raw OCR response to canonical schema
 */
export function normalizeOcrResponse(
  raw: RawOcrResponse,
  sourceFormat: string = 'unknown'
): NormalizedOcr {
  const pages = raw.pages.map((rawPage) => normalizePage(rawPage, raw.model));

  return {
    pages,
    metadata: {
      processingTime: raw.processingTime,
      model: raw.model,
      sourceFormat,
    },
  };
}

/**
 * Normalize a single page
 */
function normalizePage(
  rawPage: RawOcrResponse['pages'][0],
  model: string
): NormalizedPage {
  const { widthPx, heightPx } = rawPage;

  // Normalize blocks
  const blocks: NormalizedBlock[] = rawPage.blocks.map((rawBlock) => ({
    text: rawBlock.text,
    bbox: toNormalized(rawBlock.bbox, widthPx, heightPx),
    blockType: rawBlock.blockType,
    lines: rawBlock.lines.map((rawLine) => ({
      text: rawLine.text,
      bbox: toNormalized(rawLine.bbox, widthPx, heightPx),
      tokens: rawLine.tokens.map((rawToken) => ({
        text: rawToken.text,
        bbox: toNormalized(rawToken.bbox, widthPx, heightPx),
        confidence: rawToken.confidence,
      })),
    })),
  }));

  // Normalize tables
  const tables: NormalizedTable[] | undefined = rawPage.tables?.map(
    (rawTable) => ({
      bbox: toNormalized(rawTable.bbox, widthPx, heightPx),
      rows: rawTable.rows,
      cols: rawTable.cols,
      cells: rawTable.cells.map((cell: any) => ({
        rowIndex: cell.rowIndex || 0,
        colIndex: cell.colIndex || 0,
        rowSpan: cell.rowSpan || 1,
        colSpan: cell.colSpan || 1,
        text: cell.text || '',
        bbox: cell.bbox
          ? toNormalized(cell.bbox, widthPx, heightPx)
          : { x: 0, y: 0, w: 0, h: 0 },
      })),
    })
  );

  // Normalize figures
  const figures: NormalizedFigure[] | undefined = rawPage.figures?.map(
    (rawFigure) => ({
      bbox: toNormalized(rawFigure.bbox, widthPx, heightPx),
      figureType: rawFigure.figureType,
    })
  );

  return {
    pageIndex: rawPage.pageIndex,
    dpi: rawPage.dpi,
    widthPx,
    heightPx,
    blocks,
    tables,
    figures,
    readingOrder: rawPage.readingOrder,
  };
}

/**
 * Extract all text from normalized OCR in reading order
 */
export function extractText(ocr: NormalizedOcr): string {
  const texts: string[] = [];

  for (const page of ocr.pages) {
    const blocks = page.readingOrder
      ? page.readingOrder.map((idx) => page.blocks[idx])
      : page.blocks;

    for (const block of blocks) {
      if (block?.text?.trim()) {
        texts.push(block.text);
      }
    }
  }

  return texts.join('\n\n');
}

/**
 * Extract text from a specific page
 */
export function extractPageText(page: NormalizedPage): string {
  const blocks = page.readingOrder
    ? page.readingOrder.map((idx) => page.blocks[idx])
    : page.blocks;

  return blocks.map((block) => block?.text).join('\n\n');
}

/**
 * Find blocks near a given normalized bbox (useful for field detection)
 */
export function findNearbyBlocks(
  page: NormalizedPage,
  targetBBox: { x: number; y: number; w: number; h: number },
  maxDistance: number = 0.05
): NormalizedBlock[] {
  const targetCenterX = targetBBox.x + targetBBox.w / 2;
  const targetCenterY = targetBBox.y + targetBBox.h / 2;

  return page.blocks.filter((block) => {
    const blockCenterX = block.bbox.x + block.bbox.w / 2;
    const blockCenterY = block.bbox.y + block.bbox.h / 2;

    const distance = Math.sqrt(
      Math.pow(blockCenterX - targetCenterX, 2) +
        Math.pow(blockCenterY - targetCenterY, 2)
    );

    return distance <= maxDistance;
  });
}

/**
 * Group blocks by vertical proximity (useful for form rows)
 */
export function groupBlocksByRow(
  blocks: NormalizedBlock[],
  tolerance: number = 0.01
): NormalizedBlock[][] {
  if (blocks.length === 0) return [];

  // Sort by y position
  const sorted = [...blocks].sort((a, b) => a.bbox.y - b.bbox.y);

  const rows: NormalizedBlock[][] = [];
  let currentRow: NormalizedBlock[] = [sorted[0]!];
  let currentY = sorted[0]!.bbox.y;

  for (let i = 1; i < sorted.length; i++) {
    const block = sorted[i];

    if (Math.abs(block?.bbox.y ?? 0 - currentY) <= tolerance) {
      // Same row
      currentRow.push(block!);
    } else {
      // New row
      rows.push(currentRow);
      currentRow = [block!];
      currentY = block?.bbox.y ?? 0;
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Chunk OCR content for LLM processing (respects layout boundaries)
 */
export function chunkOcrForLLM(
  ocr: NormalizedOcr,
  maxTokensPerChunk: number = 4000
): Array<{
  pages: NormalizedPage[];
  text: string;
  estimatedTokens: number;
}> {
  const chunks: Array<{
    pages: NormalizedPage[];
    text: string;
    estimatedTokens: number;
  }> = [];

  let currentPages: NormalizedPage[] = [];
  let currentText = '';
  let currentTokens = 0;

  for (const page of ocr.pages) {
    const pageText = extractPageText(page);
    const pageTokens = estimateTokens(pageText);

    if (
      currentTokens + pageTokens > maxTokensPerChunk &&
      currentPages.length > 0
    ) {
      // Flush current chunk
      chunks.push({
        pages: currentPages,
        text: currentText,
        estimatedTokens: currentTokens,
      });

      currentPages = [];
      currentText = '';
      currentTokens = 0;
    }

    currentPages.push(page);
    currentText += (currentText ? '\n\n---\n\n' : '') + pageText;
    currentTokens += pageTokens;
  }

  if (currentPages.length > 0) {
    chunks.push({
      pages: currentPages,
      text: currentText,
      estimatedTokens: currentTokens,
    });
  }

  return chunks;
}

/**
 * Rough token estimation (1 token ≈ 4 characters for Japanese)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
