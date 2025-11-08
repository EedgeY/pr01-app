'use client';

import { useEffect, useState, useRef } from 'react';
import { Editor, TLShape } from 'tldraw';

interface SimpleBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DistanceGuide {
  type: 'horizontal' | 'vertical';
  start: { x: number; y: number };
  end: { x: number; y: number };
  distance: number;
  labelPosition: { x: number; y: number };
}

interface DistanceGuidesProps {
  editor: Editor | null;
}

export function DistanceGuides({ editor }: DistanceGuidesProps) {
  const [guides, setGuides] = useState<DistanceGuide[]>([]);
  const [, setForceUpdate] = useState(0);

  useEffect(() => {
    if (!editor) return;

    // コンテナの位置を監視して更新
    const updatePosition = () => {
      setForceUpdate((prev) => prev + 1);
    };

    const updateGuides = () => {
      const selectedIds = editor.getSelectedShapeIds();
      if (selectedIds.length === 0) {
        setGuides([]);
        return;
      }

      const allShapes = editor.getCurrentPageShapes();

      // 有効なシェイプのみをフィルタリング
      const validShapes = allShapes.filter((shape) => {
        // シェイプが実際に存在するか確認
        const shapeRecord = editor.getShape(shape.id);
        if (!shapeRecord) return false;

        // グループシェイプは除外（子要素で処理される）
        if (shape.type === 'group') return false;

        // バウンディングボックスが取得できるか確認
        const bounds = editor.getShapePageBounds(shape.id);
        if (!bounds || bounds.w <= 0 || bounds.h <= 0) return false;

        return true;
      });

      const selectedShapes = validShapes.filter((shape) =>
        selectedIds.includes(shape.id)
      );
      const otherShapes = validShapes.filter(
        (shape) => !selectedIds.includes(shape.id) && !shape.isLocked
      );

      if (selectedShapes.length === 0) {
        setGuides([]);
        return;
      }

      const newGuides: DistanceGuide[] = [];
      const proximityThreshold = 200; // 200px以内のシェイプを近接とみなす

      // 選択されたシェイプのバウンディングボックスを計算
      const selectedBounds = getCombinedBounds(selectedShapes, editor);
      if (!selectedBounds || selectedBounds.w <= 0 || selectedBounds.h <= 0) {
        setGuides([]);
        return;
      }

      // 近接するシェイプを検出
      for (const otherShape of otherShapes) {
        const otherBounds = editor.getShapePageBounds(otherShape.id);
        if (!otherBounds || otherBounds.w <= 0 || otherBounds.h <= 0) continue;

        // 型を合わせるためにSimpleBounds形式に変換
        const otherBox: SimpleBounds = {
          x: otherBounds.x,
          y: otherBounds.y,
          w: otherBounds.w,
          h: otherBounds.h,
        };

        const distance = getMinimumDistance(selectedBounds, otherBox);
        if (distance > proximityThreshold) continue;

        // シンプルな距離ガイドラインを生成
        const guides = generateDistanceGuides(selectedBounds, otherBox);
        newGuides.push(...guides);
      }

      // 選択されたシェイプ間の距離も表示
      if (selectedShapes.length > 1) {
        for (let i = 0; i < selectedShapes.length; i++) {
          for (let j = i + 1; j < selectedShapes.length; j++) {
            const shape1 = selectedShapes[i];
            const shape2 = selectedShapes[j];

            if (!shape1 || !shape2) continue;

            const bounds1Raw = editor.getShapePageBounds(shape1.id);
            const bounds2Raw = editor.getShapePageBounds(shape2.id);

            if (!bounds1Raw || !bounds2Raw) continue;

            // 無効なバウンディングボックスを除外
            if (
              bounds1Raw.w <= 0 ||
              bounds1Raw.h <= 0 ||
              bounds2Raw.w <= 0 ||
              bounds2Raw.h <= 0
            ) {
              continue;
            }

            // 型を合わせるためにSimpleBounds形式に変換
            const box1: SimpleBounds = {
              x: bounds1Raw.x,
              y: bounds1Raw.y,
              w: bounds1Raw.w,
              h: bounds1Raw.h,
            };
            const box2: SimpleBounds = {
              x: bounds2Raw.x,
              y: bounds2Raw.y,
              w: bounds2Raw.w,
              h: bounds2Raw.h,
            };

            const distance = getMinimumDistance(box1, box2);
            if (distance > proximityThreshold) continue;

            const guides = generateDistanceGuides(box1, box2);
            newGuides.push(...guides);
          }
        }
      }

      setGuides(newGuides);
    };

    updateGuides();

    // 変更を監視
    const cleanup = editor.store.listen(() => {
      updateGuides();
    });

    // コンテナの位置を監視
    const container = editor.getContainer();
    let resizeObserver: ResizeObserver | null = null;

    if (container) {
      resizeObserver = new ResizeObserver(updatePosition);
      resizeObserver.observe(container);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      cleanup();
    };
  }, [editor]);

  if (guides.length === 0 || !editor) return null;

  return (
    <div
      className='tl-overlays pointer-events-none'
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {guides.map((guide, index) => {
        const startScreen = editor.pageToScreen({
          x: guide.start.x,
          y: guide.start.y,
        });
        const endScreen = editor.pageToScreen({
          x: guide.end.x,
          y: guide.end.y,
        });
        const labelScreen = editor.pageToScreen(guide.labelPosition);

        if (!startScreen || !endScreen || !labelScreen) return null;

        // デバッグ用（開発環境のみ）
        if (process.env.NODE_ENV === 'development' && index === 0) {
          console.log('DistanceGuide Debug:', {
            page: { start: guide.start, end: guide.end },
            screen: { start: startScreen, end: endScreen },
          });
        }

        // ビューポート外のガイドラインは表示しない
        const viewport = editor.getViewportPageBounds();
        if (viewport) {
          const isVisible =
            (guide.start.x >= viewport.x - 100 &&
              guide.start.x <= viewport.x + viewport.w + 100 &&
              guide.start.y >= viewport.y - 100 &&
              guide.start.y <= viewport.y + viewport.h + 100) ||
            (guide.end.x >= viewport.x - 100 &&
              guide.end.x <= viewport.x + viewport.w + 100 &&
              guide.end.y >= viewport.y - 100 &&
              guide.end.y <= viewport.y + viewport.h + 100);
          if (!isVisible) return null;
        }

        const angle =
          Math.atan2(endScreen.y - startScreen.y, endScreen.x - startScreen.x) *
          (180 / Math.PI);
        const length = Math.sqrt(
          Math.pow(endScreen.x - startScreen.x, 2) +
            Math.pow(endScreen.y - startScreen.y, 2)
        );

        // 等間隔の「x」マークを生成（20px間隔）
        const markerInterval = 20;
        const markerCount = Math.max(1, Math.floor(length / markerInterval));
        const markers = [];

        for (let i = 1; i < markerCount; i++) {
          const t = i / (markerCount + 1);
          const markerX = startScreen.x + (endScreen.x - startScreen.x) * t;
          const markerY = startScreen.y + (endScreen.y - startScreen.y) * t;

          markers.push(
            <div
              key={`marker-${i}`}
              className='absolute'
              style={{
                left: `${markerX - 4}px`,
                top: `${markerY - 4}px`,
                width: '8px',
                height: '8px',
                transform: `rotate(${angle}deg)`,
                transformOrigin: 'center center',
              }}
            >
              <svg
                width='8'
                height='8'
                viewBox='0 0 8 8'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <line
                  x1='0'
                  y1='0'
                  x2='8'
                  y2='8'
                  stroke='#f97316'
                  strokeWidth='1.5'
                  opacity='0.9'
                />
                <line
                  x1='8'
                  y1='0'
                  x2='0'
                  y2='8'
                  stroke='#f97316'
                  strokeWidth='1.5'
                  opacity='0.9'
                />
              </svg>
            </div>
          );
        }

        return (
          <div key={index}>
            {/* ガイドライン */}
            <div
              className='absolute origin-left'
              style={{
                left: `${startScreen.x}px`,
                top: `${startScreen.y}px`,
                width: `${length}px`,
                height: '1px',
                backgroundColor: '#f97316',
                opacity: 0.8,
                transform: `rotate(${angle}deg)`,
                transformOrigin: 'left center',
                borderTop: '1px dashed #f97316',
              }}
            />
            {/* 等間隔の「x」マーク */}
            {markers}
            {/* 端点のマーカー（開始点） */}
            <div
              className='absolute rounded-full'
              style={{
                left: `${startScreen.x - 3}px`,
                top: `${startScreen.y - 3}px`,
                width: '6px',
                height: '6px',
                backgroundColor: '#f97316',
                opacity: 0.9,
              }}
            />
            {/* 端点のマーカー（終了点） */}
            <div
              className='absolute rounded-full'
              style={{
                left: `${endScreen.x - 3}px`,
                top: `${endScreen.y - 3}px`,
                width: '6px',
                height: '6px',
                backgroundColor: '#f97316',
                opacity: 0.9,
              }}
            />
            {/* 距離ラベル */}
            <div
              className='absolute flex items-center justify-center rounded px-2 py-0.5 text-xs font-semibold text-white'
              style={{
                left: `${labelScreen.x - 20}px`,
                top: `${labelScreen.y - 10}px`,
                backgroundColor: '#f97316',
                opacity: 0.9,
              }}
            >
              {Math.round(guide.distance)}px
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 複数のシェイプの結合されたバウンディングボックスを取得
function getCombinedBounds(
  shapes: TLShape[],
  editor: Editor
): SimpleBounds | null {
  if (shapes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let validCount = 0;

  for (const shape of shapes) {
    // シェイプが存在するか確認
    const shapeRecord = editor.getShape(shape.id);
    if (!shapeRecord) continue;

    const bounds = editor.getShapePageBounds(shape.id);
    if (!bounds || bounds.w <= 0 || bounds.h <= 0) continue;

    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.w);
    maxY = Math.max(maxY, bounds.y + bounds.h);
    validCount++;
  }

  if (validCount === 0 || minX === Infinity) return null;

  const width = maxX - minX;
  const height = maxY - minY;

  // 無効なバウンディングボックスを除外
  if (width <= 0 || height <= 0) return null;

  return {
    x: minX,
    y: minY,
    w: width,
    h: height,
  };
}

// 2つのバウンディングボックス間の最小距離を計算
function getMinimumDistance(box1: SimpleBounds, box2: SimpleBounds): number {
  // 重なっている場合は0を返す
  if (
    box1.x < box2.x + box2.w &&
    box1.x + box1.w > box2.x &&
    box1.y < box2.y + box2.h &&
    box1.y + box1.h > box2.y
  ) {
    return 0;
  }

  // 左右の関係
  const horizontalDistance =
    box1.x + box1.w < box2.x
      ? box2.x - (box1.x + box1.w)
      : box1.x - (box2.x + box2.w);

  // 上下の関係
  const verticalDistance =
    box1.y + box1.h < box2.y
      ? box2.y - (box1.y + box1.h)
      : box1.y - (box2.y + box2.h);

  // 対角線の距離
  if (horizontalDistance > 0 && verticalDistance > 0) {
    return Math.sqrt(
      horizontalDistance * horizontalDistance +
        verticalDistance * verticalDistance
    );
  }

  // 水平または垂直のみの距離
  return Math.max(horizontalDistance, verticalDistance);
}

// シンプルな距離ガイドラインを生成
function generateDistanceGuides(
  box1: SimpleBounds,
  box2: SimpleBounds
): DistanceGuide[] {
  const guides: DistanceGuide[] = [];

  // 水平方向の距離（左右の関係）
  const horizontalDistance = getHorizontalDistance(box1, box2);
  if (horizontalDistance !== null && horizontalDistance <= 200) {
    // シェイプの中央Y座標を使用
    const centerY1 = box1.y + box1.h / 2;
    const centerY2 = box2.y + box2.h / 2;
    const guideY = (centerY1 + centerY2) / 2;

    if (box1.x + box1.w <= box2.x) {
      // box1の右端からbox2の左端
      guides.push({
        type: 'horizontal',
        start: { x: box1.x + box1.w, y: guideY },
        end: { x: box2.x, y: guideY },
        distance: horizontalDistance,
        labelPosition: {
          x: (box1.x + box1.w + box2.x) / 2,
          y: guideY - 15,
        },
      });
    } else if (box2.x + box2.w <= box1.x) {
      // box2の右端からbox1の左端
      guides.push({
        type: 'horizontal',
        start: { x: box2.x + box2.w, y: guideY },
        end: { x: box1.x, y: guideY },
        distance: horizontalDistance,
        labelPosition: {
          x: (box2.x + box2.w + box1.x) / 2,
          y: guideY - 15,
        },
      });
    }
  }

  // 垂直方向の距離（上下の関係）
  const verticalDistance = getVerticalDistance(box1, box2);
  if (verticalDistance !== null && verticalDistance <= 200) {
    // シェイプの中央X座標を使用
    const centerX1 = box1.x + box1.w / 2;
    const centerX2 = box2.x + box2.w / 2;
    const guideX = (centerX1 + centerX2) / 2;

    if (box1.y + box1.h <= box2.y) {
      // box1の下端からbox2の上端
      guides.push({
        type: 'vertical',
        start: { x: guideX, y: box1.y + box1.h },
        end: { x: guideX, y: box2.y },
        distance: verticalDistance,
        labelPosition: {
          x: guideX - 15,
          y: (box1.y + box1.h + box2.y) / 2,
        },
      });
    } else if (box2.y + box2.h <= box1.y) {
      // box2の下端からbox1の上端
      guides.push({
        type: 'vertical',
        start: { x: guideX, y: box2.y + box2.h },
        end: { x: guideX, y: box1.y },
        distance: verticalDistance,
        labelPosition: {
          x: guideX - 15,
          y: (box2.y + box2.h + box1.y) / 2,
        },
      });
    }
  }

  return guides;
}

// 水平方向の距離を計算（重なっていない場合のみ）
function getHorizontalDistance(
  box1: SimpleBounds,
  box2: SimpleBounds
): number | null {
  // 垂直方向に重なっている場合のみ
  if (box1.y + box1.h < box2.y || box2.y + box2.h < box1.y) {
    return null; // 重なっていないので距離を表示しない
  }

  if (box1.x + box1.w <= box2.x) {
    return box2.x - (box1.x + box1.w);
  }
  if (box2.x + box2.w <= box1.x) {
    return box1.x - (box2.x + box2.w);
  }
  return null; // 水平方向に重なっている
}

// 垂直方向の距離を計算（重なっていない場合のみ）
function getVerticalDistance(
  box1: SimpleBounds,
  box2: SimpleBounds
): number | null {
  // 水平方向に重なっている場合のみ
  if (box1.x + box1.w < box2.x || box2.x + box2.w < box1.x) {
    return null; // 重なっていないので距離を表示しない
  }

  if (box1.y + box1.h <= box2.y) {
    return box2.y - (box1.y + box1.h);
  }
  if (box2.y + box2.h <= box1.y) {
    return box1.y - (box2.y + box2.h);
  }
  return null; // 垂直方向に重なっている
}
