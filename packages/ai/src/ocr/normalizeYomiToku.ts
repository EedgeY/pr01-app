/**
 * YomiToku output normalization
 *
 * Converts raw YomiToku OCR output to normalized schema with DPI-independent coordinates
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
