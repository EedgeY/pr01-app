'use client';

import { useEffect, useRef } from 'react';
import type { NormalizedPage } from '@workspace/ai/src/ocr/types';
import type { DetectedField } from '@workspace/ai';

interface OcrCanvasProps {
  page: NormalizedPage;
  imageUrl: string;
  showBlocks: boolean;
  showTables: boolean;
  showFigures: boolean;
  showFields: boolean;
  detectedFields: DetectedField[];
  selectedBlock: {
    type: 'block' | 'table' | 'figure' | 'field';
    index: number;
  } | null;
}

export function OcrCanvas({
  page,
  imageUrl,
  showBlocks,
  showTables,
  showFigures,
  showFields,
  detectedFields,
  selectedBlock,
}: OcrCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvasへの描画はブラウザのCanvas APIと同期するための副作用
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // ブロックを描画（青）
      if (showBlocks) {
        ctx.font = '12px monospace';

        page.blocks.forEach((block, idx) => {
          const isSelected =
            selectedBlock?.type === 'block' && selectedBlock.index === idx;

          ctx.strokeStyle = isSelected
            ? 'rgba(239, 68, 68, 1)'
            : 'rgba(59, 130, 246, 0.8)';
          ctx.lineWidth = isSelected ? 4 : 2;
          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(59, 130, 246, 0.95)';

          const x = block.bbox.x * img.width;
          const y = block.bbox.y * img.height;
          const w = block.bbox.w * img.width;
          const h = block.bbox.h * img.height;
          ctx.strokeRect(x, y, w, h);

          if (isSelected) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(x, y, w, h);
          }

          const bboxText = `[${block.bbox.x.toFixed(3)}, ${block.bbox.y.toFixed(3)}, ${block.bbox.w.toFixed(3)}, ${block.bbox.h.toFixed(3)}]`;
          const textY = y > 15 ? y - 3 : y + 12;

          const textMetrics = ctx.measureText(bboxText);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(x, textY - 10, textMetrics.width + 4, 14);

          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(59, 130, 246, 0.95)';
          ctx.fillText(bboxText, x + 2, textY);
        });
      }

      // テーブル（オレンジ）
      if (showTables && page.tables && page.tables.length > 0) {
        ctx.font = '14px sans-serif';

        page.tables.forEach((table, idx) => {
          const isSelected =
            selectedBlock?.type === 'table' && selectedBlock.index === idx;

          ctx.strokeStyle = isSelected
            ? 'rgba(239, 68, 68, 1)'
            : 'rgba(249, 115, 22, 0.8)';
          ctx.lineWidth = isSelected ? 5 : 3;
          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(249, 115, 22, 0.9)';

          const x = table.bbox.x * img.width;
          const y = table.bbox.y * img.height;
          const w = table.bbox.w * img.width;
          const h = table.bbox.h * img.height;

          ctx.strokeRect(x, y, w, h);

          if (isSelected) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(x, y, w, h);
          }

          const tableLabel = `Table ${table.rows}x${table.cols}`;
          const labelY = y > 35 ? y - 22 : y + h + 20;

          const labelMetrics = ctx.measureText(tableLabel);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(x, labelY - 12, labelMetrics.width + 4, 16);

          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(249, 115, 22, 0.9)';
          ctx.fillText(tableLabel, x + 2, labelY);

          ctx.font = '12px monospace';
          const bboxText = `[${table.bbox.x.toFixed(3)}, ${table.bbox.y.toFixed(3)}, ${table.bbox.w.toFixed(3)}, ${table.bbox.h.toFixed(3)}]`;
          const bboxY = y > 35 ? y - 5 : y + h + 35;

          const bboxMetrics = ctx.measureText(bboxText);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(x, bboxY - 10, bboxMetrics.width + 4, 14);

          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(249, 115, 22, 0.9)';
          ctx.fillText(bboxText, x + 2, bboxY);

          ctx.font = '14px sans-serif';

          ctx.strokeStyle = isSelected
            ? 'rgba(239, 68, 68, 0.5)'
            : 'rgba(249, 115, 22, 0.4)';
          ctx.lineWidth = 1;
          for (const cell of table.cells) {
            const cx = cell.bbox.x * img.width;
            const cy = cell.bbox.y * img.height;
            const cw = cell.bbox.w * img.width;
            const ch = cell.bbox.h * img.height;
            ctx.strokeRect(cx, cy, cw, ch);
          }
          ctx.strokeStyle = isSelected
            ? 'rgba(239, 68, 68, 1)'
            : 'rgba(249, 115, 22, 0.8)';
          ctx.lineWidth = isSelected ? 5 : 3;
        });
      }

      // 図表（緑）
      if (showFigures && page.figures && page.figures.length > 0) {
        ctx.font = '14px sans-serif';

        page.figures.forEach((figure, idx) => {
          const isSelected =
            selectedBlock?.type === 'figure' && selectedBlock.index === idx;

          ctx.strokeStyle = isSelected
            ? 'rgba(239, 68, 68, 1)'
            : 'rgba(34, 197, 94, 0.8)';
          ctx.lineWidth = isSelected ? 5 : 3;
          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(34, 197, 94, 0.9)';

          const x = figure.bbox.x * img.width;
          const y = figure.bbox.y * img.height;
          const w = figure.bbox.w * img.width;
          const h = figure.bbox.h * img.height;
          ctx.strokeRect(x, y, w, h);

          if (isSelected) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(x, y, w, h);
          }

          const figureLabel = `Figure: ${figure.figureType}`;
          const labelY = y > 35 ? y - 22 : y + h + 20;

          const labelMetrics = ctx.measureText(figureLabel);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(x, labelY - 12, labelMetrics.width + 4, 16);

          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(34, 197, 94, 0.9)';
          ctx.fillText(figureLabel, x + 2, labelY);

          ctx.font = '12px monospace';
          const bboxText = `[${figure.bbox.x.toFixed(3)}, ${figure.bbox.y.toFixed(3)}, ${figure.bbox.w.toFixed(3)}, ${figure.bbox.h.toFixed(3)}]`;
          const bboxY = y > 35 ? y - 5 : y + h + 35;

          const bboxMetrics = ctx.measureText(bboxText);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(x, bboxY - 10, bboxMetrics.width + 4, 14);

          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(34, 197, 94, 0.9)';
          ctx.fillText(bboxText, x + 2, bboxY);

          ctx.font = '14px sans-serif';
        });
      }

      // AI検出フィールド（紫）
      if (showFields && detectedFields.length > 0) {
        ctx.font = '14px sans-serif';

        const pageFields = detectedFields.filter(
          (field) => field.pageIndex === page.pageIndex
        );

        pageFields.forEach((field, idx) => {
          const isSelected =
            selectedBlock?.type === 'field' && selectedBlock.index === idx;

          ctx.strokeStyle = isSelected
            ? 'rgba(239, 68, 68, 1)'
            : 'rgba(168, 85, 247, 0.9)';
          ctx.lineWidth = isSelected ? 5 : 3;
          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(168, 85, 247, 0.95)';

          const x = field.bboxNormalized.x * img.width;
          const y = field.bboxNormalized.y * img.height;
          const w = field.bboxNormalized.w * img.width;
          const h = field.bboxNormalized.h * img.height;

          ctx.strokeRect(x, y, w, h);

          if (Array.isArray(field.segments) && field.segments.length > 0) {
            const prevDash = ctx.getLineDash();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)';
            ctx.lineWidth = 2;
            for (const seg of field.segments) {
              const sx = seg.bboxNormalized.x * img.width;
              const sy = seg.bboxNormalized.y * img.height;
              const sw = seg.bboxNormalized.w * img.width;
              const sh = seg.bboxNormalized.h * img.height;
              ctx.strokeRect(sx, sy, sw, sh);
            }
            ctx.setLineDash(prevDash);
          }

          if (isSelected) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
            ctx.fillRect(x, y, w, h);
          }

          const fieldLabel = `${field.label} (${field.type})`;
          const labelY = y > 35 ? y - 22 : y + h + 20;

          const labelMetrics = ctx.measureText(fieldLabel);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillRect(x, labelY - 12, labelMetrics.width + 4, 16);

          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(168, 85, 247, 0.95)';
          ctx.fillText(fieldLabel, x + 2, labelY);

          ctx.font = '12px monospace';
          const bboxText = `[${field.bboxNormalized.x.toFixed(3)}, ${field.bboxNormalized.y.toFixed(3)}, ${field.bboxNormalized.w.toFixed(3)}, ${field.bboxNormalized.h.toFixed(3)}]`;
          const bboxY = y > 35 ? y - 5 : y + h + 35;

          const bboxMetrics = ctx.measureText(bboxText);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillRect(x, bboxY - 10, bboxMetrics.width + 4, 14);

          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(168, 85, 247, 0.95)';
          ctx.fillText(bboxText, x + 2, bboxY);

          ctx.font = '14px sans-serif';
        });
      }
    };
    img.src = imageUrl;
  }, [
    page,
    imageUrl,
    showBlocks,
    showTables,
    showFigures,
    showFields,
    detectedFields,
    selectedBlock,
  ]);

  return (
    <div className="bg-background rounded border overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ maxHeight: '600px', objectFit: 'contain' }}
      />
    </div>
  );
}

