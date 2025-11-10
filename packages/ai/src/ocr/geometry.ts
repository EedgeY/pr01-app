/**
 * Coordinate system utilities
 * 
 * Handles conversions between different coordinate systems:
 * - Normalized: [0,1] range (DPI-independent, canonical)
 * - Pixel: absolute pixel coordinates
 * - Point: PDF points (72 DPI)
 */

import type { NormalizedBBox, PixelBBox } from './types';

/**
 * Convert pixel bbox to normalized bbox
 */
export function toNormalized(
  bbox: PixelBBox,
  widthPx: number,
  heightPx: number
): NormalizedBBox {
  return {
    x: bbox.x / widthPx,
    y: bbox.y / heightPx,
    w: bbox.w / widthPx,
    h: bbox.h / heightPx,
  };
}

/**
 * Convert normalized bbox to pixel bbox
 */
export function fromNormalized(
  bbox: NormalizedBBox,
  widthPx: number,
  heightPx: number
): PixelBBox {
  return {
    x: bbox.x * widthPx,
    y: bbox.y * heightPx,
    w: bbox.w * widthPx,
    h: bbox.h * heightPx,
  };
}

/**
 * Convert pixel coordinates to PDF points (72 DPI)
 */
export function pixelToPoint(
  bbox: PixelBBox,
  dpi: number
): PixelBBox {
  const scale = 72 / dpi;
  return {
    x: bbox.x * scale,
    y: bbox.y * scale,
    w: bbox.w * scale,
    h: bbox.h * scale,
  };
}

/**
 * Convert PDF points to pixel coordinates
 */
export function pointToPixel(
  bbox: PixelBBox,
  dpi: number
): PixelBBox {
  const scale = dpi / 72;
  return {
    x: bbox.x * scale,
    y: bbox.y * scale,
    w: bbox.w * scale,
    h: bbox.h * scale,
  };
}

/**
 * Scale bbox by a factor
 */
export function scaleBBox(
  bbox: PixelBBox,
  scale: number
): PixelBBox {
  return {
    x: bbox.x * scale,
    y: bbox.y * scale,
    w: bbox.w * scale,
    h: bbox.h * scale,
  };
}

/**
 * Check if two normalized bboxes overlap
 */
export function bboxesOverlap(
  a: NormalizedBBox,
  b: NormalizedBBox
): boolean {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

/**
 * Calculate intersection over union (IoU) of two normalized bboxes
 */
export function calculateIoU(
  a: NormalizedBBox,
  b: NormalizedBBox
): number {
  const intersectionX = Math.max(a.x, b.x);
  const intersectionY = Math.max(a.y, b.y);
  const intersectionW = Math.max(
    0,
    Math.min(a.x + a.w, b.x + b.w) - intersectionX
  );
  const intersectionH = Math.max(
    0,
    Math.min(a.y + a.h, b.y + b.h) - intersectionY
  );
  
  const intersectionArea = intersectionW * intersectionH;
  const aArea = a.w * a.h;
  const bArea = b.w * b.h;
  const unionArea = aArea + bArea - intersectionArea;
  
  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

/**
 * Get center point of a normalized bbox
 */
export function getBBoxCenter(
  bbox: NormalizedBBox
): { x: number; y: number } {
  return {
    x: bbox.x + bbox.w / 2,
    y: bbox.y + bbox.h / 2,
  };
}

/**
 * Calculate Euclidean distance between two normalized bboxes (center to center)
 */
export function bboxDistance(
  a: NormalizedBBox,
  b: NormalizedBBox
): number {
  const centerA = getBBoxCenter(a);
  const centerB = getBBoxCenter(b);
  const dx = centerA.x - centerB.x;
  const dy = centerA.y - centerB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Expand bbox by a margin (in normalized units)
 */
export function expandBBox(
  bbox: NormalizedBBox,
  margin: number
): NormalizedBBox {
  return {
    x: Math.max(0, bbox.x - margin),
    y: Math.max(0, bbox.y - margin),
    w: Math.min(1 - bbox.x + margin, bbox.w + 2 * margin),
    h: Math.min(1 - bbox.y + margin, bbox.h + 2 * margin),
  };
}

/**
 * Merge multiple bboxes into a single bounding box
 */
export function mergeBBoxes(
  bboxes: NormalizedBBox[]
): NormalizedBBox | null {
  if (bboxes.length === 0) return null;
  
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  
  for (const bbox of bboxes) {
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.w);
    maxY = Math.max(maxY, bbox.y + bbox.h);
  }
  
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

/**
 * Check if bbox is valid (within [0,1] range for normalized)
 */
export function isValidNormalizedBBox(bbox: NormalizedBBox): boolean {
  return (
    bbox.x >= 0 &&
    bbox.y >= 0 &&
    bbox.w >= 0 &&
    bbox.h >= 0 &&
    bbox.x + bbox.w <= 1 &&
    bbox.y + bbox.h <= 1
  );
}

/**
 * Clamp bbox to valid normalized range [0,1]
 */
export function clampNormalizedBBox(bbox: NormalizedBBox): NormalizedBBox {
  const x = Math.max(0, Math.min(1, bbox.x));
  const y = Math.max(0, Math.min(1, bbox.y));
  const maxW = 1 - x;
  const maxH = 1 - y;
  
  return {
    x,
    y,
    w: Math.max(0, Math.min(maxW, bbox.w)),
    h: Math.max(0, Math.min(maxH, bbox.h)),
  };
}



