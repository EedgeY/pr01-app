/**
 * 座標系ユーティリティ（Coordinate System Utilities）
 *
 * OCR結果やPDF上の位置情報を扱うための座標変換・計算ユーティリティ集です。
 * 異なる座標系間の相互変換や、バウンディングボックス（bbox）の幾何学的計算を提供します。
 *
 * ## サポートする座標系
 *
 * 1. **正規化座標（Normalized）**: [0,1]の範囲で表現
 *    - DPI非依存で、画像サイズに関わらず一貫した扱いが可能
 *    - システム内部での標準座標系（canonical）として使用
 *    - x, y: 左上を(0,0)とした相対位置
 *    - w, h: 幅と高さの相対値
 *
 * 2. **ピクセル座標（Pixel）**: 絶対ピクセル単位
 *    - 実際の画像サイズに基づく座標
 *    - OCRエンジンからの生出力で使用されることが多い
 *
 * 3. **ポイント座標（Point）**: PDFポイント単位（72 DPI基準）
 *    - PDF標準の座標系（1インチ = 72ポイント）
 *    - PDFライブラリ（pdfme等）との連携に使用
 *
 * ## 主な機能
 *
 * ### 座標変換
 * - `toNormalized()`: ピクセル座標 → 正規化座標
 * - `fromNormalized()`: 正規化座標 → ピクセル座標
 * - `pixelToPoint()`: ピクセル座標 → PDFポイント座標
 * - `pointToPixel()`: PDFポイント座標 → ピクセル座標
 * - `scaleBBox()`: 任意の倍率でbboxをスケーリング
 *
 * ### 幾何学的計算
 * - `bboxesOverlap()`: 2つのbboxが重なっているか判定
 * - `calculateIoU()`: IoU（Intersection over Union）を計算
 *   - オブジェクト検出の精度評価やマッチングに使用
 * - `bboxDistance()`: 2つのbbox間の中心点間距離（ユークリッド距離）
 * - `getBBoxCenter()`: bboxの中心座標を取得
 *
 * ### Bbox操作
 * - `expandBBox()`: bboxを指定マージン分拡張（パディング追加）
 * - `mergeBBoxes()`: 複数のbboxを包含する最小bboxを生成
 * - `clampNormalizedBBox()`: bboxを[0,1]の有効範囲内にクランプ
 * - `isValidNormalizedBBox()`: 正規化bboxが有効な範囲内か検証
 *
 * ## 使用例
 *
 * ```typescript
 * // OCRエンジンからのピクセル座標を正規化座標に変換
 * const normalized = toNormalized(
 *   { x: 100, y: 200, w: 300, h: 50 },
 *   1920,  // 画像幅
 *   1080   // 画像高さ
 * );
 *
 * // PDF生成時にポイント座標に変換
 * const points = pixelToPoint(pixelBbox, 300); // 300 DPI
 *
 * // フィールド検出のための近接判定
 * if (bboxDistance(fieldBbox, textBbox) < 0.05) {
 *   // 距離が近い場合の処理
 * }
 * ```
 *
 * ## 設計思想
 *
 * - **DPI非依存性**: 正規化座標を標準とすることで、異なるDPIの画像でも
 *   一貫した処理が可能
 * - **型安全性**: TypeScriptの型システムを活用し、座標系の混同を防止
 * - **Pure Functions**: すべての関数は副作用なしの純粋関数として実装
 * - **テスタビリティ**: 単純な入出力で、ユニットテストが容易
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
export function pixelToPoint(bbox: PixelBBox, dpi: number): PixelBBox {
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
export function pointToPixel(bbox: PixelBBox, dpi: number): PixelBBox {
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
export function scaleBBox(bbox: PixelBBox, scale: number): PixelBBox {
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
export function bboxesOverlap(a: NormalizedBBox, b: NormalizedBBox): boolean {
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
export function calculateIoU(a: NormalizedBBox, b: NormalizedBBox): number {
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
export function getBBoxCenter(bbox: NormalizedBBox): { x: number; y: number } {
  return {
    x: bbox.x + bbox.w / 2,
    y: bbox.y + bbox.h / 2,
  };
}

/**
 * Calculate Euclidean distance between two normalized bboxes (center to center)
 */
export function bboxDistance(a: NormalizedBBox, b: NormalizedBBox): number {
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
export function mergeBBoxes(bboxes: NormalizedBBox[]): NormalizedBBox | null {
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
