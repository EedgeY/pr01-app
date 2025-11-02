"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@workspace/ui/components/button';

type Props = {
  file: File;
  onCancel: () => void;
  onCropped: (file: File) => void;
  previewSize?: number; // px
  outputSize?: number; // px
};

export function CustomAvatarCropper({
  file,
  onCancel,
  onCropped,
  previewSize = 256,
  outputSize = 512,
}: Props) {
  const [zoom, setZoom] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0); // -1..1
  const [offsetY, setOffsetY] = useState<number>(0); // -1..1
  const [busy, setBusy] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;
    img.crossOrigin = 'anonymous';
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    redrawPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, zoom, offsetX, offsetY, previewSize]);

  function getCropRect(img: HTMLImageElement) {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const base = Math.min(nw, nh);
    const cropSize = Math.max(1, Math.floor(base / Math.max(1, zoom)));
    const midX = nw / 2;
    const midY = nh / 2;
    const maxShiftX = (nw - cropSize) / 2;
    const maxShiftY = (nh - cropSize) / 2;
    const cx = midX + offsetX * maxShiftX;
    const cy = midY + offsetY * maxShiftY;
    const sx = Math.min(Math.max(0, Math.floor(cx - cropSize / 2)), nw - cropSize);
    const sy = Math.min(Math.max(0, Math.floor(cy - cropSize / 2)), nh - cropSize);
    return { sx, sy, s: cropSize };
  }

  function redrawPreview() {
    if (!image || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = previewSize;
    canvasRef.current.height = previewSize;
    ctx.clearRect(0, 0, previewSize, previewSize);
    const { sx, sy, s } = getCropRect(image);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, sx, sy, s, s, 0, 0, previewSize, previewSize);
  }

  async function confirm() {
    if (!image) return;
    setBusy(true);
    try {
      const { sx, sy, s } = getCropRect(image);
      const out = document.createElement('canvas');
      out.width = outputSize;
      out.height = outputSize;
      const octx = out.getContext('2d');
      if (!octx) throw new Error('no-ctx');
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';
      octx.drawImage(image, sx, sy, s, s, 0, 0, outputSize, outputSize);
      const blob: Blob = await new Promise((resolve) =>
        out.toBlob((b) => resolve(b as Blob), 'image/webp', 0.9)
      );
      const cropped = new File([blob], 'avatar.webp', { type: 'image/webp' });
      onCropped(cropped);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg p-4 w-full max-w-lg">
        <div className="flex flex-col items-center gap-3">
          <canvas ref={canvasRef} className="rounded-full border" />
          <div className="w-full space-y-2">
            <label className="block text-sm">ズーム</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
            <label className="block text-sm">左右位置</label>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={offsetX}
              onChange={(e) => setOffsetX(Number(e.target.value))}
              className="w-full"
            />
            <label className="block text-sm">上下位置</label>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={offsetY}
              onChange={(e) => setOffsetY(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              キャンセル
            </Button>
            <Button onClick={confirm} disabled={busy || !image}>
              {busy ? '処理中...' : '切り抜いてアップロード'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


