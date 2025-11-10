/**
 * Geometry utilities tests
 */

import {
  toNormalized,
  fromNormalized,
  pixelToPoint,
  pointToPixel,
  bboxesOverlap,
  calculateIoU,
  getBBoxCenter,
  bboxDistance,
  expandBBox,
  mergeBBoxes,
  isValidNormalizedBBox,
  clampNormalizedBBox,
} from '../geometry';
import type { PixelBBox, NormalizedBBox } from '../types';

describe('Coordinate Conversions', () => {
  const widthPx = 1000;
  const heightPx = 1000;

  test('toNormalized converts pixel bbox to normalized', () => {
    const pixelBBox: PixelBBox = { x: 100, y: 200, w: 300, h: 400 };
    const normalized = toNormalized(pixelBBox, widthPx, heightPx);

    expect(normalized.x).toBeCloseTo(0.1);
    expect(normalized.y).toBeCloseTo(0.2);
    expect(normalized.w).toBeCloseTo(0.3);
    expect(normalized.h).toBeCloseTo(0.4);
  });

  test('fromNormalized converts normalized bbox to pixel', () => {
    const normalizedBBox: NormalizedBBox = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    const pixel = fromNormalized(normalizedBBox, widthPx, heightPx);

    expect(pixel.x).toBeCloseTo(100);
    expect(pixel.y).toBeCloseTo(200);
    expect(pixel.w).toBeCloseTo(300);
    expect(pixel.h).toBeCloseTo(400);
  });

  test('round-trip conversion preserves values', () => {
    const original: PixelBBox = { x: 123.45, y: 678.9, w: 234.56, h: 345.67 };
    const normalized = toNormalized(original, widthPx, heightPx);
    const backToPixel = fromNormalized(normalized, widthPx, heightPx);

    expect(backToPixel.x).toBeCloseTo(original.x, 5);
    expect(backToPixel.y).toBeCloseTo(original.y, 5);
    expect(backToPixel.w).toBeCloseTo(original.w, 5);
    expect(backToPixel.h).toBeCloseTo(original.h, 5);
  });

  test('pixelToPoint converts at 300 DPI', () => {
    const pixelBBox: PixelBBox = { x: 300, y: 300, w: 300, h: 300 };
    const pointBBox = pixelToPoint(pixelBBox, 300);

    // 300 DPI -> 72 DPI: scale = 72/300 = 0.24
    expect(pointBBox.x).toBeCloseTo(72);
    expect(pointBBox.y).toBeCloseTo(72);
    expect(pointBBox.w).toBeCloseTo(72);
    expect(pointBBox.h).toBeCloseTo(72);
  });

  test('pointToPixel converts at 300 DPI', () => {
    const pointBBox: PixelBBox = { x: 72, y: 72, w: 72, h: 72 };
    const pixelBBox = pointToPixel(pointBBox, 300);

    // 72 DPI -> 300 DPI: scale = 300/72 ≈ 4.167
    expect(pixelBBox.x).toBeCloseTo(300);
    expect(pixelBBox.y).toBeCloseTo(300);
    expect(pixelBBox.w).toBeCloseTo(300);
    expect(pixelBBox.h).toBeCloseTo(300);
  });
});

describe('BBox Operations', () => {
  test('bboxesOverlap detects overlapping boxes', () => {
    const a: NormalizedBBox = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
    const b: NormalizedBBox = { x: 0.2, y: 0.2, w: 0.3, h: 0.3 };

    expect(bboxesOverlap(a, b)).toBe(true);
  });

  test('bboxesOverlap detects non-overlapping boxes', () => {
    const a: NormalizedBBox = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
    const b: NormalizedBBox = { x: 0.5, y: 0.5, w: 0.2, h: 0.2 };

    expect(bboxesOverlap(a, b)).toBe(false);
  });

  test('calculateIoU returns 1 for identical boxes', () => {
    const a: NormalizedBBox = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
    const b: NormalizedBBox = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };

    expect(calculateIoU(a, b)).toBeCloseTo(1.0);
  });

  test('calculateIoU returns 0 for non-overlapping boxes', () => {
    const a: NormalizedBBox = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
    const b: NormalizedBBox = { x: 0.5, y: 0.5, w: 0.2, h: 0.2 };

    expect(calculateIoU(a, b)).toBe(0);
  });

  test('getBBoxCenter returns correct center', () => {
    const bbox: NormalizedBBox = { x: 0.1, y: 0.2, w: 0.4, h: 0.6 };
    const center = getBBoxCenter(bbox);

    expect(center.x).toBeCloseTo(0.3); // 0.1 + 0.4/2
    expect(center.y).toBeCloseTo(0.5); // 0.2 + 0.6/2
  });

  test('bboxDistance calculates correct distance', () => {
    const a: NormalizedBBox = { x: 0, y: 0, w: 0.1, h: 0.1 };
    const b: NormalizedBBox = { x: 0.3, y: 0.4, w: 0.1, h: 0.1 };

    // Centers: a=(0.05, 0.05), b=(0.35, 0.45)
    // Distance: sqrt((0.3)^2 + (0.4)^2) = 0.5
    const distance = bboxDistance(a, b);
    expect(distance).toBeCloseTo(0.5);
  });

  test('expandBBox expands by margin', () => {
    const bbox: NormalizedBBox = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
    const expanded = expandBBox(bbox, 0.1);

    expect(expanded.x).toBeCloseTo(0.3);
    expect(expanded.y).toBeCloseTo(0.3);
    expect(expanded.w).toBeCloseTo(0.4);
    expect(expanded.h).toBeCloseTo(0.4);
  });

  test('mergeBBoxes creates bounding box of all boxes', () => {
    const boxes: NormalizedBBox[] = [
      { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      { x: 0.5, y: 0.5, w: 0.2, h: 0.2 },
    ];

    const merged = mergeBBoxes(boxes);
    expect(merged).not.toBeNull();
    expect(merged!.x).toBeCloseTo(0.1);
    expect(merged!.y).toBeCloseTo(0.1);
    expect(merged!.w).toBeCloseTo(0.6); // 0.7 - 0.1
    expect(merged!.h).toBeCloseTo(0.6); // 0.7 - 0.1
  });

  test('mergeBBoxes returns null for empty array', () => {
    const merged = mergeBBoxes([]);
    expect(merged).toBeNull();
  });
});

describe('BBox Validation', () => {
  test('isValidNormalizedBBox accepts valid bbox', () => {
    const bbox: NormalizedBBox = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    expect(isValidNormalizedBBox(bbox)).toBe(true);
  });

  test('isValidNormalizedBBox rejects negative coordinates', () => {
    const bbox: NormalizedBBox = { x: -0.1, y: 0.2, w: 0.3, h: 0.4 };
    expect(isValidNormalizedBBox(bbox)).toBe(false);
  });

  test('isValidNormalizedBBox rejects out-of-bounds bbox', () => {
    const bbox: NormalizedBBox = { x: 0.8, y: 0.8, w: 0.3, h: 0.3 };
    expect(isValidNormalizedBBox(bbox)).toBe(false);
  });

  test('clampNormalizedBBox clamps to valid range', () => {
    const bbox: NormalizedBBox = { x: -0.1, y: 0.9, w: 0.5, h: 0.5 };
    const clamped = clampNormalizedBBox(bbox);

    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0.9);
    expect(clamped.w).toBeLessThanOrEqual(1);
    expect(clamped.h).toBeLessThanOrEqual(0.1);
  });
});




