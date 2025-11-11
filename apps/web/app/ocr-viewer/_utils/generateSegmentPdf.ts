/**
 * セグメント指定領域のみを含む1ページPDFを生成
 * 元のページサイズと位置を維持し、指定領域以外は白地にする
 */

import { PDFDocument } from 'pdf-lib';
import type { Segment } from '../_hooks/useSegments';

// PDF.jsを動的にインポート
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function ensurePdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  return pdfjsLib;
}

interface GenerateSegmentPdfOptions {
  file: File;
  pageIndex: number;
  segment: Segment;
  dpi?: number;
}

/**
 * セグメント領域のみを含むPDFを生成
 *
 * @param options - 生成オプション
 * @returns 生成されたPDFのBlob
 */
export async function generateSegmentPdf(
  options: GenerateSegmentPdfOptions
): Promise<Blob> {
  const { file, pageIndex, segment, dpi = 300 } = options;
  const pdfjs = await ensurePdfJs();

  // 元PDFを読み込み
  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await pdfjs.getDocument(arrayBuffer).promise;
  const page = await sourcePdf.getPage(pageIndex + 1); // pdf.jsは1-indexed

  // 元ページのサイズを取得（ポイント単位）
  const viewport = page.getViewport({ scale: 1.0 });
  const pageWidthPt = viewport.width;
  const pageHeightPt = viewport.height;

  // 高解像度でレンダリング（DPI換算）
  const scale = dpi / 72; // 72 DPI = 1.0 scale
  const renderViewport = page.getViewport({ scale });

  // キャンバスに元ページ全体を描画
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context not available');
  }

  canvas.width = renderViewport.width;
  canvas.height = renderViewport.height;

  await page.render({
    canvasContext: context,
    viewport: renderViewport,
    canvas,
  }).promise;

  // 新しいキャンバスを作成し、セグメント領域のみをクリップして描画
  const clippedCanvas = document.createElement('canvas');
  const clippedContext = clippedCanvas.getContext('2d');
  if (!clippedContext) {
    throw new Error('Clipped canvas context not available');
  }

  clippedCanvas.width = canvas.width;
  clippedCanvas.height = canvas.height;

  // 白地で塗りつぶし
  clippedContext.fillStyle = '#ffffff';
  clippedContext.fillRect(0, 0, clippedCanvas.width, clippedCanvas.height);

  // セグメント領域のピクセル座標を計算
  const segX = segment.nx * canvas.width;
  const segY = segment.ny * canvas.height;
  const segW = segment.nw * canvas.width;
  const segH = segment.nh * canvas.height;

  // クリップ領域を設定してセグメント部分のみ描画
  clippedContext.save();
  clippedContext.beginPath();
  clippedContext.rect(segX, segY, segW, segH);
  clippedContext.clip();
  clippedContext.drawImage(canvas, 0, 0);
  clippedContext.restore();

  // キャンバスをPNGに変換
  const pngBlob = await new Promise<Blob>((resolve) => {
    clippedCanvas.toBlob((blob) => {
      if (!blob) throw new Error('Failed to create PNG blob');
      resolve(blob);
    }, 'image/png');
  });

  // pdf-libで新しいPDFを作成
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(await pngBlob.arrayBuffer());

  // 元のページサイズでページを追加
  const pdfPage = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

  // 画像を元のページサイズで配置
  pdfPage.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: pageWidthPt,
    height: pageHeightPt,
  });

  // PDFをバイト配列として保存
  const pdfBytes = await pdfDoc.save();

  return new Blob([new Uint8Array(pdfBytes)], {
    type: 'application/pdf',
  });
}

/**
 * セグメントPDFをダウンロード
 */
export function downloadSegmentPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
