'use client';

import { useEffect, useRef, useState } from 'react';

type Bbox = { x: number; y: number; w: number; h: number };

type SelectedBbox = {
  bbox: Bbox;
  type: 'block' | 'table' | 'figure';
  id: string;
};

type DeletedElement = {
  bbox: Bbox;
  type: 'block' | 'table' | 'figure';
};

type InteractiveBboxOverlayProps = {
  imageUrl: string;
  selectedBboxes: SelectedBbox[];
  unionBbox: Bbox | null;
  deletedElements: DeletedElement[];
  onBboxUpdate: (id: string, bbox: Bbox) => void;
};

export function InteractiveBboxOverlay({
  imageUrl,
  selectedBboxes,
  unionBbox,
  deletedElements,
  onBboxUpdate,
}: InteractiveBboxOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<{
    id: string;
    type: 'move' | 'resize';
    corner?: 'tl' | 'tr' | 'bl' | 'br';
    startX: number;
    startY: number;
    startBbox: Bbox;
  } | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Canvas描画はブラウザのCanvas APIとの同期のための副作用
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      setImageSize({ width: img.width, height: img.height });

      deletedElements.forEach((item) => {
        const x = item.bbox.x * img.width;
        const y = item.bbox.y * img.height;
        const w = item.bbox.w * img.width;
        const h = item.bbox.h * img.height;

        ctx.fillStyle = 'rgba(128, 128, 128, 0.7)';
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.moveTo(x + w, y);
        ctx.lineTo(x, y + h);
        ctx.stroke();
      });

      selectedBboxes.forEach((item) => {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
        ctx.lineWidth = 5;
        ctx.setLineDash([]);

        const x = item.bbox.x * img.width;
        const y = item.bbox.y * img.height;
        const w = item.bbox.w * img.width;
        const h = item.bbox.h * img.height;

        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.fillRect(x, y, w, h);

        const handleSize = 12;
        ctx.fillStyle = 'rgba(255, 215, 0, 1)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 2;

        ctx.fillRect(
          x - handleSize / 2,
          y - handleSize / 2,
          handleSize,
          handleSize
        );
        ctx.strokeRect(
          x - handleSize / 2,
          y - handleSize / 2,
          handleSize,
          handleSize
        );

        ctx.fillRect(
          x + w - handleSize / 2,
          y - handleSize / 2,
          handleSize,
          handleSize
        );
        ctx.strokeRect(
          x + w - handleSize / 2,
          y - handleSize / 2,
          handleSize,
          handleSize
        );

        ctx.fillRect(
          x - handleSize / 2,
          y + h - handleSize / 2,
          handleSize,
          handleSize
        );
        ctx.strokeRect(
          x - handleSize / 2,
          y + h - handleSize / 2,
          handleSize,
          handleSize
        );

        ctx.fillRect(
          x + w - handleSize / 2,
          y + h - handleSize / 2,
          handleSize,
          handleSize
        );
        ctx.strokeRect(
          x + w - handleSize / 2,
          y + h - handleSize / 2,
          handleSize,
          handleSize
        );
      });

      if (unionBbox && selectedBboxes.length > 1) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
        ctx.lineWidth = 6;
        ctx.setLineDash([15, 10]);

        const x = unionBbox.x * img.width;
        const y = unionBbox.y * img.height;
        const w = unionBbox.w * img.width;
        const h = unionBbox.h * img.height;

        ctx.strokeRect(x, y, w, h);

        ctx.setLineDash([]);
        ctx.font = 'bold 16px sans-serif';
        const label = 'グループ化範囲';
        const labelY = y > 30 ? y - 10 : y + h + 25;

        const metrics = ctx.measureText(label);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
        ctx.fillRect(x, labelY - 16, metrics.width + 8, 20);

        ctx.fillStyle = 'white';
        ctx.fillText(label, x + 4, labelY);
      }
    };
    img.src = imageUrl;
  }, [deletedElements, imageUrl, selectedBboxes, unionBbox]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || imageSize.width === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = imageSize.width / rect.width;
    const scaleY = imageSize.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const handleSize = 12;

    for (const item of selectedBboxes) {
      const x = item.bbox.x * imageSize.width;
      const y = item.bbox.y * imageSize.height;
      const w = item.bbox.w * imageSize.width;
      const h = item.bbox.h * imageSize.height;

      if (
        Math.abs(mouseX - x) < handleSize &&
        Math.abs(mouseY - y) < handleSize
      ) {
        setDragTarget({
          id: item.id,
          type: 'resize',
          corner: 'tl',
          startX: mouseX,
          startY: mouseY,
          startBbox: { ...item.bbox },
        });
        setIsDragging(true);
        return;
      }

      if (
        Math.abs(mouseX - (x + w)) < handleSize &&
        Math.abs(mouseY - y) < handleSize
      ) {
        setDragTarget({
          id: item.id,
          type: 'resize',
          corner: 'tr',
          startX: mouseX,
          startY: mouseY,
          startBbox: { ...item.bbox },
        });
        setIsDragging(true);
        return;
      }

      if (
        Math.abs(mouseX - x) < handleSize &&
        Math.abs(mouseY - (y + h)) < handleSize
      ) {
        setDragTarget({
          id: item.id,
          type: 'resize',
          corner: 'bl',
          startX: mouseX,
          startY: mouseY,
          startBbox: { ...item.bbox },
        });
        setIsDragging(true);
        return;
      }

      if (
        Math.abs(mouseX - (x + w)) < handleSize &&
        Math.abs(mouseY - (y + h)) < handleSize
      ) {
        setDragTarget({
          id: item.id,
          type: 'resize',
          corner: 'br',
          startX: mouseX,
          startY: mouseY,
          startBbox: { ...item.bbox },
        });
        setIsDragging(true);
        return;
      }

      if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) {
        setDragTarget({
          id: item.id,
          type: 'move',
          startX: mouseX,
          startY: mouseY,
          startBbox: { ...item.bbox },
        });
        setIsDragging(true);
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragTarget || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = imageSize.width / rect.width;
    const scaleY = imageSize.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const deltaX = (mouseX - dragTarget.startX) / imageSize.width;
    const deltaY = (mouseY - dragTarget.startY) / imageSize.height;

    if (dragTarget.type === 'move') {
      const newBbox = {
        x: Math.max(
          0,
          Math.min(1 - dragTarget.startBbox.w, dragTarget.startBbox.x + deltaX)
        ),
        y: Math.max(
          0,
          Math.min(1 - dragTarget.startBbox.h, dragTarget.startBbox.y + deltaY)
        ),
        w: dragTarget.startBbox.w,
        h: dragTarget.startBbox.h,
      };
      onBboxUpdate(dragTarget.id, newBbox);
    } else if (dragTarget.type === 'resize') {
      let newBbox = { ...dragTarget.startBbox };

      switch (dragTarget.corner) {
        case 'tl':
          newBbox.x = Math.max(0, dragTarget.startBbox.x + deltaX);
          newBbox.y = Math.max(0, dragTarget.startBbox.y + deltaY);
          newBbox.w = Math.max(0.01, dragTarget.startBbox.w - deltaX);
          newBbox.h = Math.max(0.01, dragTarget.startBbox.h - deltaY);
          break;
        case 'tr':
          newBbox.y = Math.max(0, dragTarget.startBbox.y + deltaY);
          newBbox.w = Math.max(0.01, dragTarget.startBbox.w + deltaX);
          newBbox.h = Math.max(0.01, dragTarget.startBbox.h - deltaY);
          break;
        case 'bl':
          newBbox.x = Math.max(0, dragTarget.startBbox.x + deltaX);
          newBbox.w = Math.max(0.01, dragTarget.startBbox.w - deltaX);
          newBbox.h = Math.max(0.01, dragTarget.startBbox.h + deltaY);
          break;
        case 'br':
          newBbox.w = Math.max(0.01, dragTarget.startBbox.w + deltaX);
          newBbox.h = Math.max(0.01, dragTarget.startBbox.h + deltaY);
          break;
      }

      if (newBbox.x + newBbox.w > 1) newBbox.w = 1 - newBbox.x;
      if (newBbox.y + newBbox.h > 1) newBbox.h = 1 - newBbox.y;

      onBboxUpdate(dragTarget.id, newBbox);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragTarget(null);
  };

  return (
    <div
      ref={containerRef}
      className='absolute top-0 left-0 w-full h-full'
      style={{
        maxHeight: '600px',
        zIndex: 10,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas
        ref={canvasRef}
        className='w-full h-full pointer-events-none'
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
}
