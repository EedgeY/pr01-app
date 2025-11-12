import type { Bbox, ElementType } from '../_types';

/**
 * 要素IDを生成
 */
export const createElementId = (type: ElementType, index: number): string =>
  `${type}-${index}`;

/**
 * 複数のbboxのUnion（最小包含矩形）を計算
 */
export const bboxUnion = (bboxes: Bbox[]): Bbox | null => {
  if (bboxes.length === 0) return null;
  const minX = Math.min(...bboxes.map((b) => b.x));
  const minY = Math.min(...bboxes.map((b) => b.y));
  const maxX = Math.max(...bboxes.map((b) => b.x + b.w));
  const maxY = Math.max(...bboxes.map((b) => b.y + b.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

/**
 * Y座標順（上から下）にソート、同じ行ならX座標順（左から右）
 */
export const sortByPosition = <T extends { bbox: Bbox }>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    const yDiff = a.bbox.y - b.bbox.y;
    // Y座標の差が小さい場合（同じ行とみなす）はX座標で比較
    if (Math.abs(yDiff) < 0.01) {
      return a.bbox.x - b.bbox.x;
    }
    return yDiff;
  });
};

