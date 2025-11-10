/**
 * Tiling utilities for segmented OCR processing
 * 
 * Provides functions to:
 * - Generate automatic grid-based tiles
 * - Merge OCR results from multiple tiles
 * - Handle overlapping regions with deduplication
 */

import type { NormalizedBBox, NormalizedOcr, NormalizedPage, NormalizedBlock } from './types';
import { calculateIoU, mergeBBoxes } from './geometry';

/**
 * Tile specification for OCR processing
 */
export interface TileSpec {
  pageIndex: number;
  bboxNormalized: NormalizedBBox;
  overlap?: number;
}

/**
 * Generate automatic grid-based tiles for a page
 * 
 * @param pageWidthPx - Page width in pixels
 * @param pageHeightPx - Page height in pixels
 * @param targetTileSizePx - Target tile size in pixels (default: 1200)
 * @param overlapRatio - Overlap ratio between tiles (default: 0.1 = 10%)
 * @returns Array of tile specifications with normalized coordinates
 */
export function buildAutoGridTiles(
  pageWidthPx: number,
  pageHeightPx: number,
  targetTileSizePx = 1200,
  overlapRatio = 0.1
): NormalizedBBox[] {
  // Calculate number of tiles needed in each dimension
  const cols = Math.ceil(pageWidthPx / targetTileSizePx);
  const rows = Math.ceil(pageHeightPx / targetTileSizePx);
  
  // Calculate actual tile size with overlap
  const tileWidth = pageWidthPx / cols;
  const tileHeight = pageHeightPx / rows;
  
  // Calculate overlap in pixels
  const overlapX = tileWidth * overlapRatio;
  const overlapY = tileHeight * overlapRatio;
  
  const tiles: NormalizedBBox[] = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Calculate tile bounds with overlap
      const x = Math.max(0, col * tileWidth - (col > 0 ? overlapX : 0));
      const y = Math.max(0, row * tileHeight - (row > 0 ? overlapY : 0));
      const w = Math.min(
        tileWidth + (col > 0 ? overlapX : 0) + (col < cols - 1 ? overlapX : 0),
        pageWidthPx - x
      );
      const h = Math.min(
        tileHeight + (row > 0 ? overlapY : 0) + (row < rows - 1 ? overlapY : 0),
        pageHeightPx - y
      );
      
      // Convert to normalized coordinates
      tiles.push({
        x: x / pageWidthPx,
        y: y / pageHeightPx,
        w: w / pageWidthPx,
        h: h / pageHeightPx,
      });
    }
  }
  
  return tiles;
}

/**
 * Generate tile specifications for multiple pages
 * 
 * @param pages - Array of page dimensions
 * @param targetTileSizePx - Target tile size in pixels
 * @param overlapRatio - Overlap ratio between tiles
 * @returns Array of tile specifications
 */
export function buildTileSpecsForPages(
  pages: Array<{ widthPx: number; heightPx: number }>,
  targetTileSizePx = 1200,
  overlapRatio = 0.1
): TileSpec[] {
  const specs: TileSpec[] = [];
  
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    if (!page) continue;
    
    const tiles = buildAutoGridTiles(
      page.widthPx,
      page.heightPx,
      targetTileSizePx,
      overlapRatio
    );
    
    for (const bboxNormalized of tiles) {
      specs.push({
        pageIndex,
        bboxNormalized,
        overlap: overlapRatio,
      });
    }
  }
  
  return specs;
}

/**
 * Deduplicate blocks based on IoU threshold
 * Prefers blocks with higher confidence or longer text
 * 
 * @param blocks - Array of blocks to deduplicate
 * @param iouThreshold - IoU threshold for considering blocks as duplicates (default: 0.5)
 * @returns Deduplicated array of blocks
 */
export function deduplicateBlocks(
  blocks: NormalizedBlock[],
  iouThreshold = 0.5
): NormalizedBlock[] {
  if (blocks.length <= 1) return blocks;
  
  // Sort by confidence (average token confidence) and text length
  const sortedBlocks = [...blocks].sort((a, b) => {
    // Calculate average confidence
    const aConfidence = a.lines.reduce((sum, line) => {
      const lineConf = line.tokens.reduce((s, t) => s + (t.confidence || 0), 0) / Math.max(1, line.tokens.length);
      return sum + lineConf;
    }, 0) / Math.max(1, a.lines.length);
    
    const bConfidence = b.lines.reduce((sum, line) => {
      const lineConf = line.tokens.reduce((s, t) => s + (t.confidence || 0), 0) / Math.max(1, line.tokens.length);
      return sum + lineConf;
    }, 0) / Math.max(1, b.lines.length);
    
    // Sort by confidence first, then by text length
    if (Math.abs(aConfidence - bConfidence) > 0.01) {
      return bConfidence - aConfidence;
    }
    return b.text.length - a.text.length;
  });
  
  const kept: NormalizedBlock[] = [];
  
  for (const block of sortedBlocks) {
    // Check if this block overlaps significantly with any kept block
    let isDuplicate = false;
    for (const keptBlock of kept) {
      const iou = calculateIoU(block.bbox, keptBlock.bbox);
      if (iou > iouThreshold) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      kept.push(block);
    }
  }
  
  return kept;
}

/**
 * Merge OCR results from multiple tiles into a single page
 * 
 * @param tilePages - Array of OCR pages from tile processing
 * @param options - Merge options
 * @returns Merged page with deduplicated content
 */
export function mergeTilePages(
  tilePages: NormalizedPage[],
  options: {
    iouThreshold?: number;
    preferHigherConfidence?: boolean;
  } = {}
): NormalizedPage | null {
  if (tilePages.length === 0) return null;
  
  const { iouThreshold = 0.5, preferHigherConfidence = true } = options;
  
  // Use first page as base
  const basePage = tilePages[0];
  if (!basePage) return null;
  
  // Collect all blocks from all tiles
  const allBlocks: NormalizedBlock[] = [];
  for (const page of tilePages) {
    allBlocks.push(...page.blocks);
  }
  
  // Deduplicate blocks
  const deduplicatedBlocks = deduplicateBlocks(allBlocks, iouThreshold);
  
  // Collect tables and figures (simple concatenation, no deduplication for now)
  const allTables = tilePages.flatMap(p => p.tables || []);
  const allFigures = tilePages.flatMap(p => p.figures || []);
  
  return {
    pageIndex: basePage.pageIndex,
    dpi: basePage.dpi,
    widthPx: basePage.widthPx,
    heightPx: basePage.heightPx,
    blocks: deduplicatedBlocks,
    tables: allTables.length > 0 ? allTables : undefined,
    figures: allFigures.length > 0 ? allFigures : undefined,
    readingOrder: undefined, // Reading order needs to be recalculated
  };
}

/**
 * Merge multiple tile-based OCR results into a complete OCR result
 * 
 * @param tileOcrResults - Array of OCR results from tile processing
 * @param options - Merge options
 * @returns Merged OCR result
 */
export function mergeNormalizedOcrPages(
  tileOcrResults: NormalizedOcr[],
  options: {
    iouThreshold?: number;
    preferHigherConfidence?: boolean;
  } = {}
): NormalizedOcr | null {
  if (tileOcrResults.length === 0) return null;
  
  // Group pages by page index
  const pagesByIndex = new Map<number, NormalizedPage[]>();
  
  for (const ocrResult of tileOcrResults) {
    for (const page of ocrResult.pages) {
      const existing = pagesByIndex.get(page.pageIndex) || [];
      existing.push(page);
      pagesByIndex.set(page.pageIndex, existing);
    }
  }
  
  // Merge each page
  const mergedPages: NormalizedPage[] = [];
  for (const [pageIndex, pages] of Array.from(pagesByIndex.entries()).sort((a, b) => a[0] - b[0])) {
    const mergedPage = mergeTilePages(pages, options);
    if (mergedPage) {
      mergedPages.push(mergedPage);
    }
  }
  
  // Use metadata from first result
  const baseResult = tileOcrResults[0];
  if (!baseResult) return null;
  
  return {
    pages: mergedPages,
    metadata: {
      processingTime: tileOcrResults.reduce((sum, r) => sum + r.metadata.processingTime, 0),
      model: baseResult.metadata.model + '-tiled',
      sourceFormat: baseResult.metadata.sourceFormat,
    },
  };
}

/**
 * Calculate optimal tile size based on page dimensions and complexity
 * 
 * @param pageWidthPx - Page width in pixels
 * @param pageHeightPx - Page height in pixels
 * @param maxTileSizePx - Maximum tile size in pixels (default: 1600)
 * @param minTileSizePx - Minimum tile size in pixels (default: 800)
 * @returns Recommended tile size in pixels
 */
export function calculateOptimalTileSize(
  pageWidthPx: number,
  pageHeightPx: number,
  maxTileSizePx = 1600,
  minTileSizePx = 800
): number {
  const pageArea = pageWidthPx * pageHeightPx;
  
  // For small pages, use the whole page
  if (pageArea < minTileSizePx * minTileSizePx) {
    return Math.max(pageWidthPx, pageHeightPx);
  }
  
  // For medium pages, use a single tile per dimension
  if (pageArea < maxTileSizePx * maxTileSizePx * 2) {
    return Math.max(minTileSizePx, Math.min(maxTileSizePx, Math.max(pageWidthPx, pageHeightPx)));
  }
  
  // For large pages, calculate optimal tile size
  const targetTiles = Math.ceil(Math.sqrt(pageArea / (maxTileSizePx * maxTileSizePx)));
  const tileSize = Math.max(
    minTileSizePx,
    Math.min(maxTileSizePx, Math.max(pageWidthPx, pageHeightPx) / targetTiles)
  );
  
  return Math.round(tileSize);
}

/**
 * Validate tile specifications
 * 
 * @param tiles - Array of tile specifications
 * @returns True if all tiles are valid
 */
export function validateTileSpecs(tiles: TileSpec[]): boolean {
  for (const tile of tiles) {
    const bbox = tile.bboxNormalized;
    
    // Check normalized coordinates are in valid range
    // Allow small floating point error (1% tolerance)
    if (
      bbox.x < 0 || bbox.x > 1.01 ||
      bbox.y < 0 || bbox.y > 1.01 ||
      bbox.w <= 0 || bbox.w > 1.01 ||
      bbox.h <= 0 || bbox.h > 1.01 ||
      bbox.x + bbox.w > 1.01 ||
      bbox.y + bbox.h > 1.01
    ) {
      return false;
    }
    
    // Check page index is non-negative
    if (tile.pageIndex < 0) {
      return false;
    }
  }
  
  return true;
}

