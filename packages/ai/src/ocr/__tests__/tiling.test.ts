/**
 * Tiling utilities tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildAutoGridTiles,
  buildTileSpecsForPages,
  deduplicateBlocks,
  mergeTilePages,
  calculateOptimalTileSize,
  validateTileSpecs,
} from '../tiling';
import type { NormalizedBlock, NormalizedPage, NormalizedBBox } from '../types';

describe('buildAutoGridTiles', () => {
  it('should generate tiles for a single-tile page', () => {
    const tiles = buildAutoGridTiles(1000, 1000, 1200, 0.1);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it('should generate 2x2 grid with overlap', () => {
    const tiles = buildAutoGridTiles(2000, 2000, 1000, 0.1);
    expect(tiles).toHaveLength(4);
    
    // Check that tiles have overlap
    const tile0 = tiles[0];
    const tile1 = tiles[1];
    expect(tile0).toBeDefined();
    expect(tile1).toBeDefined();
    
    // Second tile should start before first tile ends (overlap)
    expect(tile1!.x).toBeLessThan(tile0!.x + tile0!.w);
  });

  it('should handle non-square pages', () => {
    const tiles = buildAutoGridTiles(3000, 1500, 1200, 0.1);
    expect(tiles.length).toBeGreaterThan(1);
    
    // All tiles should be within normalized bounds
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.w).toBeLessThanOrEqual(1.01); // Allow small floating point error
      expect(tile.y + tile.h).toBeLessThanOrEqual(1.01);
    }
  });

  it('should generate correct number of tiles for large pages', () => {
    const tiles = buildAutoGridTiles(4800, 3600, 1200, 0);
    // With no overlap: 4 cols x 3 rows = 12 tiles
    expect(tiles).toHaveLength(12);
  });
});

describe('buildTileSpecsForPages', () => {
  it('should generate specs for multiple pages', () => {
    const pages = [
      { widthPx: 2000, heightPx: 2000 },
      { widthPx: 1500, heightPx: 2000 },
    ];
    
    const specs = buildTileSpecsForPages(pages, 1200, 0.1);
    
    expect(specs.length).toBeGreaterThan(0);
    
    // Check page indices
    const page0Specs = specs.filter(s => s.pageIndex === 0);
    const page1Specs = specs.filter(s => s.pageIndex === 1);
    
    expect(page0Specs.length).toBeGreaterThan(0);
    expect(page1Specs.length).toBeGreaterThan(0);
  });
});

describe('deduplicateBlocks', () => {
  const createBlock = (
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    confidence = 0.9
  ): NormalizedBlock => ({
    text,
    bbox: { x, y, w, h },
    blockType: 'text',
    lines: [
      {
        text,
        bbox: { x, y, w, h },
        tokens: [
          {
            text,
            bbox: { x, y, w, h },
            confidence,
          },
        ],
      },
    ],
  });

  it('should keep all blocks when no overlap', () => {
    const blocks = [
      createBlock(0, 0, 0.2, 0.1, 'Block 1'),
      createBlock(0.3, 0, 0.2, 0.1, 'Block 2'),
      createBlock(0.6, 0, 0.2, 0.1, 'Block 3'),
    ];
    
    const deduplicated = deduplicateBlocks(blocks, 0.5);
    expect(deduplicated).toHaveLength(3);
  });

  it('should remove duplicate blocks with high IoU', () => {
    const blocks = [
      createBlock(0, 0, 0.2, 0.1, 'Block 1', 0.9),
      createBlock(0.01, 0.01, 0.2, 0.1, 'Block 1 duplicate', 0.8), // Lower confidence
      createBlock(0.5, 0, 0.2, 0.1, 'Block 2'),
    ];
    
    const deduplicated = deduplicateBlocks(blocks, 0.5);
    expect(deduplicated).toHaveLength(2);
    
    // Should keep the higher confidence block
    expect(deduplicated[0]?.text).toBe('Block 1');
    expect(deduplicated[1]?.text).toBe('Block 2');
  });

  it('should prefer longer text when confidence is similar', () => {
    const blocks = [
      createBlock(0, 0, 0.2, 0.1, 'Short', 0.9),
      createBlock(0.01, 0.01, 0.2, 0.1, 'Much longer text content', 0.9),
    ];
    
    const deduplicated = deduplicateBlocks(blocks, 0.5);
    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0]?.text).toBe('Much longer text content');
  });

  it('should handle empty input', () => {
    const deduplicated = deduplicateBlocks([], 0.5);
    expect(deduplicated).toHaveLength(0);
  });

  it('should handle single block', () => {
    const blocks = [createBlock(0, 0, 0.2, 0.1, 'Single block')];
    const deduplicated = deduplicateBlocks(blocks, 0.5);
    expect(deduplicated).toHaveLength(1);
  });
});

describe('mergeTilePages', () => {
  const createPage = (
    pageIndex: number,
    blocks: NormalizedBlock[]
  ): NormalizedPage => ({
    pageIndex,
    dpi: 300,
    widthPx: 2000,
    heightPx: 2000,
    blocks,
  });

  const createBlock = (
    x: number,
    y: number,
    w: number,
    h: number,
    text: string
  ): NormalizedBlock => ({
    text,
    bbox: { x, y, w, h },
    blockType: 'text',
    lines: [
      {
        text,
        bbox: { x, y, w, h },
        tokens: [
          {
            text,
            bbox: { x, y, w, h },
            confidence: 0.9,
          },
        ],
      },
    ],
  });

  it('should merge multiple tile pages', () => {
    const page1 = createPage(0, [
      createBlock(0, 0, 0.2, 0.1, 'Block 1'),
      createBlock(0.3, 0, 0.2, 0.1, 'Block 2'),
    ]);
    
    const page2 = createPage(0, [
      createBlock(0.6, 0, 0.2, 0.1, 'Block 3'),
    ]);
    
    const merged = mergeTilePages([page1, page2]);
    
    expect(merged).toBeDefined();
    expect(merged!.blocks).toHaveLength(3);
  });

  it('should deduplicate overlapping blocks from tiles', () => {
    const page1 = createPage(0, [
      createBlock(0, 0, 0.2, 0.1, 'Block 1'),
      createBlock(0.45, 0, 0.2, 0.1, 'Overlap block'),
    ]);
    
    const page2 = createPage(0, [
      createBlock(0.46, 0.01, 0.2, 0.1, 'Overlap block duplicate'),
      createBlock(0.7, 0, 0.2, 0.1, 'Block 3'),
    ]);
    
    const merged = mergeTilePages([page1, page2], { iouThreshold: 0.5 });
    
    expect(merged).toBeDefined();
    // Should have 3 blocks after deduplication (not 4)
    expect(merged!.blocks).toHaveLength(3);
  });

  it('should return null for empty input', () => {
    const merged = mergeTilePages([]);
    expect(merged).toBeNull();
  });

  it('should preserve page metadata', () => {
    const page = createPage(0, [createBlock(0, 0, 0.2, 0.1, 'Block')]);
    const merged = mergeTilePages([page]);
    
    expect(merged).toBeDefined();
    expect(merged!.pageIndex).toBe(0);
    expect(merged!.dpi).toBe(300);
    expect(merged!.widthPx).toBe(2000);
    expect(merged!.heightPx).toBe(2000);
  });
});

describe('calculateOptimalTileSize', () => {
  it('should return full page size for small pages', () => {
    const tileSize = calculateOptimalTileSize(600, 800, 1600, 800);
    expect(tileSize).toBeGreaterThanOrEqual(800);
  });

  it('should return reasonable size for medium pages', () => {
    const tileSize = calculateOptimalTileSize(2000, 2000, 1600, 800);
    expect(tileSize).toBeGreaterThanOrEqual(800);
    expect(tileSize).toBeLessThanOrEqual(1600);
  });

  it('should split large pages into multiple tiles', () => {
    const tileSize = calculateOptimalTileSize(4800, 3600, 1600, 800);
    expect(tileSize).toBeGreaterThanOrEqual(800);
    expect(tileSize).toBeLessThanOrEqual(1600);
    
    // Should require multiple tiles
    const tilesNeeded = Math.ceil(4800 / tileSize) * Math.ceil(3600 / tileSize);
    expect(tilesNeeded).toBeGreaterThan(1);
  });
});

describe('validateTileSpecs', () => {
  it('should validate correct tile specs', () => {
    const tiles = [
      {
        pageIndex: 0,
        bboxNormalized: { x: 0, y: 0, w: 0.5, h: 0.5 },
      },
      {
        pageIndex: 0,
        bboxNormalized: { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      },
    ];
    
    expect(validateTileSpecs(tiles)).toBe(true);
  });

  it('should reject tiles with negative coordinates', () => {
    const tiles = [
      {
        pageIndex: 0,
        bboxNormalized: { x: -0.1, y: 0, w: 0.5, h: 0.5 },
      },
    ];
    
    expect(validateTileSpecs(tiles)).toBe(false);
  });

  it('should reject tiles with coordinates > 1', () => {
    const tiles = [
      {
        pageIndex: 0,
        bboxNormalized: { x: 0.5, y: 0, w: 0.6, h: 0.5 }, // x + w = 1.1
      },
    ];
    
    expect(validateTileSpecs(tiles)).toBe(false);
  });

  it('should reject tiles with zero or negative dimensions', () => {
    const tiles = [
      {
        pageIndex: 0,
        bboxNormalized: { x: 0, y: 0, w: 0, h: 0.5 },
      },
    ];
    
    expect(validateTileSpecs(tiles)).toBe(false);
  });

  it('should reject tiles with negative page index', () => {
    const tiles = [
      {
        pageIndex: -1,
        bboxNormalized: { x: 0, y: 0, w: 0.5, h: 0.5 },
      },
    ];
    
    expect(validateTileSpecs(tiles)).toBe(false);
  });

  it('should accept tiles with small floating point overflow', () => {
    const tiles = [
      {
        pageIndex: 0,
        bboxNormalized: { x: 0, y: 0, w: 1.005, h: 1.005 }, // Small overflow allowed (x+w < 1.01)
      },
    ];
    
    expect(validateTileSpecs(tiles)).toBe(true);
  });
});

