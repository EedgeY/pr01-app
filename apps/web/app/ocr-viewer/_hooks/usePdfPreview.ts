/**
 * Hook for generating PDF preview images
 */

import { useState, useEffect } from 'react';

// PDF.jsを動的にインポート（サーバーサイドでの評価を回避）
let pdfjsLib: typeof import('pdfjs-dist') | null = null;
if (typeof window !== 'undefined') {
  import('pdfjs-dist').then((module) => {
    pdfjsLib = module;
    module.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  });
}

/**
 * Generate preview images from a PDF file
 */
export async function generatePdfPreview(pdfFile: File): Promise<string[]> {
  // PDF.jsが読み込まれるまで待つ
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  const urls: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    urls.push(URL.createObjectURL(blob));
  }

  return urls;
}

/**
 * Hook to manage PDF preview URLs with cleanup
 */
export function usePdfPreview() {
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      imageUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  const generatePreview = async (file: File): Promise<string[]> => {
    // Cleanup old URLs
    imageUrls.forEach((url) => URL.revokeObjectURL(url));

    if (file.type === 'application/pdf') {
      const urls = await generatePdfPreview(file);
      setImageUrls(urls);
      return urls;
    } else if (file.type.startsWith('image/')) {
      const urls = [URL.createObjectURL(file)];
      setImageUrls(urls);
      return urls;
    }

    return [];
  };

  const clearPreview = () => {
    imageUrls.forEach((url) => URL.revokeObjectURL(url));
    setImageUrls([]);
  };

  return {
    imageUrls,
    generatePreview,
    clearPreview,
  };
}

