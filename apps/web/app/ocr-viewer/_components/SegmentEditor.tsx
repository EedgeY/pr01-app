/**
 * セグメント編集コンポーネント
 * 画像上でドラッグして矩形を作成し、セグメントとして登録
 */

'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { Segment, SegmentResult } from '../_hooks/useSegments';

interface SegmentEditorProps {
  imageUrl: string;
  pageIndex: number;
  segments: Segment[];
  selectedId: string | null;
  results: Map<string, SegmentResult>;
  onSegmentAdd: (segment: Segment) => void;
  onSegmentUpdate: (id: string, updates: Partial<Segment>) => void;
  onSegmentSelect: (id: string | null) => void;
}

type DragMode = 'none' | 'create' | 'move' | 'resize';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

export function SegmentEditor({
  imageUrl,
  pageIndex,
  segments,
  selectedId,
  results,
  onSegmentAdd,
  onSegmentUpdate,
  onSegmentSelect,
}: SegmentEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [currentPoint, setCurrentPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [draggedSegmentId, setDraggedSegmentId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [originalSegment, setOriginalSegment] = useState<Segment | null>(null);
  const [showOcrBboxes, setShowOcrBboxes] = useState(true);

  // 画像を読み込んでキャンバスに描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // キャンバスサイズを画像に合わせる
      canvas.width = img.width;
      canvas.height = img.height;
      setImageSize({ width: img.width, height: img.height });

      // 画像を描画
      ctx.drawImage(img, 0, 0);

      // セグメントを描画
      drawSegments(ctx, img.width, img.height);
    };
    img.src = imageUrl;
  }, [imageUrl, segments, selectedId]);

  // リサイズハンドルのサイズ
  const HANDLE_SIZE = 8;

  // セグメントごとの色を生成（ハッシュベース）
  const getSegmentColor = useCallback((segmentId: string): string => {
    let hash = 0;
    for (let i = 0; i < segmentId.length; i++) {
      hash = segmentId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
  }, []);

  // セグメントを描画
  const drawSegments = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      // 現在のページのセグメントのみ描画
      const pageSegments = segments.filter((seg) => seg.page === pageIndex);

      pageSegments.forEach((segment) => {
        const x = segment.nx * width;
        const y = segment.ny * height;
        const w = segment.nw * width;
        const h = segment.nh * height;

        const isSelected = segment.id === selectedId;

        ctx.strokeStyle = isSelected ? '#8b5cf6' : '#3b82f6';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(x, y, w, h);

        // 半透明の塗りつぶし
        ctx.fillStyle = isSelected
          ? 'rgba(139, 92, 246, 0.1)'
          : 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(x, y, w, h);

        // 選択中のセグメントにはリサイズハンドルを表示
        if (isSelected) {
          ctx.fillStyle = '#8b5cf6';
          const handleSize = HANDLE_SIZE;

          // 8方向のハンドル
          // 北西
          ctx.fillRect(
            x - handleSize / 2,
            y - handleSize / 2,
            handleSize,
            handleSize
          );
          // 北東
          ctx.fillRect(
            x + w - handleSize / 2,
            y - handleSize / 2,
            handleSize,
            handleSize
          );
          // 南西
          ctx.fillRect(
            x - handleSize / 2,
            y + h - handleSize / 2,
            handleSize,
            handleSize
          );
          // 南東
          ctx.fillRect(
            x + w - handleSize / 2,
            y + h - handleSize / 2,
            handleSize,
            handleSize
          );
          // 北
          ctx.fillRect(
            x + w / 2 - handleSize / 2,
            y - handleSize / 2,
            handleSize,
            handleSize
          );
          // 南
          ctx.fillRect(
            x + w / 2 - handleSize / 2,
            y + h - handleSize / 2,
            handleSize,
            handleSize
          );
          // 東
          ctx.fillRect(
            x + w - handleSize / 2,
            y + h / 2 - handleSize / 2,
            handleSize,
            handleSize
          );
          // 西
          ctx.fillRect(
            x - handleSize / 2,
            y + h / 2 - handleSize / 2,
            handleSize,
            handleSize
          );
        }
      });

      // OCR結果のbboxを描画（各セグメントごと）
      if (showOcrBboxes) {
        pageSegments.forEach((segment) => {
          const result = results.get(segment.id);
          if (result?.status === 'success' && result.ocrResult) {
            const ocrPage = result.ocrResult.pages?.[0];
            if (!ocrPage?.blocks) return;

            const segmentColor = getSegmentColor(segment.id);

            ocrPage.blocks.forEach((block) => {
              // OCR結果のbboxは元のページ全体に対する正規化座標（0-1）
              // セグメントPDFは元のページサイズで生成されているため、
              // キャンバス全体のサイズに対して変換すればよい
              const bboxX = block.bbox.x * width;
              const bboxY = block.bbox.y * height;
              const bboxW = block.bbox.w * width;
              const bboxH = block.bbox.h * height;

              // bbox枠を描画
              ctx.strokeStyle = segmentColor;
              ctx.lineWidth = 1.5;
              ctx.strokeRect(bboxX, bboxY, bboxW, bboxH);

              // 半透明の塗りつぶし
              const rgb = segmentColor.match(/\d+/g);
              if (rgb) {
                ctx.fillStyle = `hsla(${rgb[0]}, ${rgb[1]}%, ${rgb[2]}%, 0.05)`;
                ctx.fillRect(bboxX, bboxY, bboxW, bboxH);
              }
            });
          }
        });
      }

      // 描画中の矩形
      if (dragMode === 'create' && startPoint && currentPoint) {
        const x = Math.min(startPoint.x, currentPoint.x);
        const y = Math.min(startPoint.y, currentPoint.y);
        const w = Math.abs(currentPoint.x - startPoint.x);
        const h = Math.abs(currentPoint.y - startPoint.y);

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
        ctx.fillRect(x, y, w, h);
      }
    },
    [
      segments,
      selectedId,
      dragMode,
      startPoint,
      currentPoint,
      pageIndex,
      showOcrBboxes,
      results,
      getSegmentColor,
    ]
  );

  // 再描画
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSize) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 画像を再描画
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      drawSegments(ctx, canvas.width, canvas.height);
    };
    img.src = imageUrl;
  }, [imageUrl, imageSize, drawSegments]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // リサイズハンドルの判定
  const getResizeHandle = useCallback(
    (
      x: number,
      y: number,
      segment: Segment,
      canvasWidth: number,
      canvasHeight: number
    ): ResizeHandle => {
      const sx = segment.nx * canvasWidth;
      const sy = segment.ny * canvasHeight;
      const sw = segment.nw * canvasWidth;
      const sh = segment.nh * canvasHeight;
      const threshold = HANDLE_SIZE;

      // 8方向のハンドルをチェック
      if (Math.abs(x - sx) < threshold && Math.abs(y - sy) < threshold)
        return 'nw';
      if (Math.abs(x - (sx + sw)) < threshold && Math.abs(y - sy) < threshold)
        return 'ne';
      if (Math.abs(x - sx) < threshold && Math.abs(y - (sy + sh)) < threshold)
        return 'sw';
      if (
        Math.abs(x - (sx + sw)) < threshold &&
        Math.abs(y - (sy + sh)) < threshold
      )
        return 'se';
      if (
        Math.abs(x - (sx + sw / 2)) < threshold &&
        Math.abs(y - sy) < threshold
      )
        return 'n';
      if (
        Math.abs(x - (sx + sw / 2)) < threshold &&
        Math.abs(y - (sy + sh)) < threshold
      )
        return 's';
      if (
        Math.abs(x - (sx + sw)) < threshold &&
        Math.abs(y - (sy + sh / 2)) < threshold
      )
        return 'e';
      if (
        Math.abs(x - sx) < threshold &&
        Math.abs(y - (sy + sh / 2)) < threshold
      )
        return 'w';

      return null;
    },
    []
  );

  // マウス座標をキャンバス座標に変換（スケール補正）
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      // CSSサイズと実際のキャンバスサイズの比率を計算
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      return { x, y };
    },
    []
  );

  // マウスダウン
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const coords = getCanvasCoords(e);
      if (!coords) return;

      const { x, y } = coords;

      // 選択中のセグメントがあればリサイズハンドルをチェック
      if (selectedId) {
        const selectedSegment = segments.find(
          (seg) => seg.id === selectedId && seg.page === pageIndex
        );
        if (selectedSegment) {
          const handle = getResizeHandle(
            x,
            y,
            selectedSegment,
            canvas.width,
            canvas.height
          );
          if (handle) {
            setDragMode('resize');
            setResizeHandle(handle);
            setDraggedSegmentId(selectedSegment.id);
            setOriginalSegment({ ...selectedSegment });
            setStartPoint({ x, y });
            return;
          }
        }
      }

      // クリックされた位置にあるセグメントをチェック
      const clickedSegment = segments
        .filter((seg) => seg.page === pageIndex)
        .find((seg) => {
          const sx = seg.nx * canvas.width;
          const sy = seg.ny * canvas.height;
          const sw = seg.nw * canvas.width;
          const sh = seg.nh * canvas.height;
          return x >= sx && x <= sx + sw && y >= sy && y <= sy + sh;
        });

      if (clickedSegment) {
        // セグメント内をクリック → 移動モード
        onSegmentSelect(clickedSegment.id);
        setDragMode('move');
        setDraggedSegmentId(clickedSegment.id);
        setOriginalSegment({ ...clickedSegment });
        setStartPoint({ x, y });
        setCurrentPoint({ x, y });
      } else {
        // 空白をクリック → 新規作成モード
        onSegmentSelect(null);
        setDragMode('create');
        setStartPoint({ x, y });
        setCurrentPoint({ x, y });
      }
    },
    [
      segments,
      pageIndex,
      selectedId,
      onSegmentSelect,
      getResizeHandle,
      getCanvasCoords,
    ]
  );

  // マウス移動
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const coords = getCanvasCoords(e);
      if (!coords) return;

      const { x, y } = coords;

      // カーソルの形状を変更
      if (dragMode === 'none' && selectedId) {
        const selectedSegment = segments.find(
          (seg) => seg.id === selectedId && seg.page === pageIndex
        );
        if (selectedSegment) {
          const handle = getResizeHandle(
            x,
            y,
            selectedSegment,
            canvas.width,
            canvas.height
          );
          if (handle) {
            const cursors: Record<NonNullable<ResizeHandle>, string> = {
              nw: 'nwse-resize',
              ne: 'nesw-resize',
              sw: 'nesw-resize',
              se: 'nwse-resize',
              n: 'ns-resize',
              s: 'ns-resize',
              e: 'ew-resize',
              w: 'ew-resize',
            };
            canvas.style.cursor = cursors[handle];
            return;
          }
        }
      }

      // セグメント内かチェック
      const hoveredSegment = segments
        .filter((seg) => seg.page === pageIndex)
        .find((seg) => {
          const sx = seg.nx * canvas.width;
          const sy = seg.ny * canvas.height;
          const sw = seg.nw * canvas.width;
          const sh = seg.nh * canvas.height;
          return x >= sx && x <= sx + sw && y >= sy && y <= sy + sh;
        });

      if (dragMode === 'none') {
        canvas.style.cursor = hoveredSegment ? 'move' : 'crosshair';
      }

      if (dragMode === 'none') return;

      setCurrentPoint({ x, y });

      // 移動モード
      if (
        dragMode === 'move' &&
        draggedSegmentId &&
        originalSegment &&
        startPoint
      ) {
        const dx = (x - startPoint.x) / canvas.width;
        const dy = (y - startPoint.y) / canvas.height;

        const newNx = Math.max(
          0,
          Math.min(1 - originalSegment.nw, originalSegment.nx + dx)
        );
        const newNy = Math.max(
          0,
          Math.min(1 - originalSegment.nh, originalSegment.ny + dy)
        );

        onSegmentUpdate(draggedSegmentId, { nx: newNx, ny: newNy });
      }

      // リサイズモード
      if (
        dragMode === 'resize' &&
        draggedSegmentId &&
        originalSegment &&
        startPoint
      ) {
        const dx = (x - startPoint.x) / canvas.width;
        const dy = (y - startPoint.y) / canvas.height;

        let newNx = originalSegment.nx;
        let newNy = originalSegment.ny;
        let newNw = originalSegment.nw;
        let newNh = originalSegment.nh;

        switch (resizeHandle) {
          case 'nw':
            newNx = Math.max(
              0,
              Math.min(
                originalSegment.nx + originalSegment.nw - 0.01,
                originalSegment.nx + dx
              )
            );
            newNy = Math.max(
              0,
              Math.min(
                originalSegment.ny + originalSegment.nh - 0.01,
                originalSegment.ny + dy
              )
            );
            newNw = originalSegment.nw - (newNx - originalSegment.nx);
            newNh = originalSegment.nh - (newNy - originalSegment.ny);
            break;
          case 'ne':
            newNy = Math.max(
              0,
              Math.min(
                originalSegment.ny + originalSegment.nh - 0.01,
                originalSegment.ny + dy
              )
            );
            newNw = Math.max(
              0.01,
              Math.min(1 - originalSegment.nx, originalSegment.nw + dx)
            );
            newNh = originalSegment.nh - (newNy - originalSegment.ny);
            break;
          case 'sw':
            newNx = Math.max(
              0,
              Math.min(
                originalSegment.nx + originalSegment.nw - 0.01,
                originalSegment.nx + dx
              )
            );
            newNw = originalSegment.nw - (newNx - originalSegment.nx);
            newNh = Math.max(
              0.01,
              Math.min(1 - originalSegment.ny, originalSegment.nh + dy)
            );
            break;
          case 'se':
            newNw = Math.max(
              0.01,
              Math.min(1 - originalSegment.nx, originalSegment.nw + dx)
            );
            newNh = Math.max(
              0.01,
              Math.min(1 - originalSegment.ny, originalSegment.nh + dy)
            );
            break;
          case 'n':
            newNy = Math.max(
              0,
              Math.min(
                originalSegment.ny + originalSegment.nh - 0.01,
                originalSegment.ny + dy
              )
            );
            newNh = originalSegment.nh - (newNy - originalSegment.ny);
            break;
          case 's':
            newNh = Math.max(
              0.01,
              Math.min(1 - originalSegment.ny, originalSegment.nh + dy)
            );
            break;
          case 'e':
            newNw = Math.max(
              0.01,
              Math.min(1 - originalSegment.nx, originalSegment.nw + dx)
            );
            break;
          case 'w':
            newNx = Math.max(
              0,
              Math.min(
                originalSegment.nx + originalSegment.nw - 0.01,
                originalSegment.nx + dx
              )
            );
            newNw = originalSegment.nw - (newNx - originalSegment.nx);
            break;
        }

        onSegmentUpdate(draggedSegmentId, {
          nx: newNx,
          ny: newNy,
          nw: newNw,
          nh: newNh,
        });
      }
    },
    [
      dragMode,
      segments,
      pageIndex,
      selectedId,
      draggedSegmentId,
      originalSegment,
      startPoint,
      resizeHandle,
      getResizeHandle,
      onSegmentUpdate,
      getCanvasCoords,
    ]
  );

  // マウスアップ
  const handleMouseUp = useCallback(() => {
    if (dragMode === 'create' && startPoint && currentPoint) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const w = Math.abs(currentPoint.x - startPoint.x);
      const h = Math.abs(currentPoint.y - startPoint.y);

      // 最小サイズチェック
      if (w >= 10 && h >= 10) {
        // 正規化座標に変換
        const nx = x / canvas.width;
        const ny = y / canvas.height;
        const nw = w / canvas.width;
        const nh = h / canvas.height;

        // セグメントを追加
        const newSegment: Segment = {
          id: `seg-${Date.now()}`,
          page: pageIndex,
          nx,
          ny,
          nw,
          nh,
        };

        onSegmentAdd(newSegment);
      }
    }

    // 状態をリセット
    setDragMode('none');
    setStartPoint(null);
    setCurrentPoint(null);
    setDraggedSegmentId(null);
    setResizeHandle(null);
    setOriginalSegment(null);
  }, [dragMode, startPoint, currentPoint, pageIndex, onSegmentAdd]);

  return (
    <div className='bg-card text-card-foreground rounded-lg border p-5'>
      <div className='mb-3 flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>セグメント編集</h3>
        <label className='flex items-center gap-2 text-sm cursor-pointer'>
          <input
            type='checkbox'
            checked={showOcrBboxes}
            onChange={(e) => setShowOcrBboxes(e.target.checked)}
            className='rounded border-input'
          />
          <span>OCR Bboxを表示</span>
        </label>
      </div>

      <div className='overflow-hidden bg-muted/30'>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className='w-full h-auto'
          style={{ cursor: 'crosshair' }}
        />
      </div>
    </div>
  );
}
