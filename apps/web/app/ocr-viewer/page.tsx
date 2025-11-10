'use client';

import { useState, useRef, useEffect } from 'react';
import type {
  NormalizedOcr,
  NormalizedPage,
} from '@workspace/ai/src/ocr/types';
import { SchemaExportButton } from './_components/SchemaExportButton';
import { FieldSchemaDetectButton } from './_components/FieldSchemaDetectButton';

// PDF.js を動的にインポート（サーバーサイドでの評価を回避）
let pdfjsLib: typeof import('pdfjs-dist') | null = null;
if (typeof window !== 'undefined') {
  import('pdfjs-dist').then((module) => {
    pdfjsLib = module;
    module.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  });
}

export default function OcrViewerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [ocr, setOcr] = useState<NormalizedOcr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState(0);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [mode, setMode] = useState<'ocr' | 'layout' | 'document'>('ocr');
  const [showBlocks, setShowBlocks] = useState(true);
  const [showTables, setShowTables] = useState(true);
  const [showFigures, setShowFigures] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<{
    type: 'block' | 'table' | 'figure';
    index: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'blocks' | 'tables' | 'figures'>(
    'blocks'
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // PDFから画像URLを生成するヘルパー関数
  const generatePdfPreview = async (pdfFile: File): Promise<string[]> => {
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
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setOcr(null);
      setError(null);
      // 既存のURLをクリーンアップ
      imageUrls.forEach((url) => URL.revokeObjectURL(url));
      setImageUrls([]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // モードに応じたエンドポイントに送信
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dpi', '300');

      const endpoint =
        mode === 'ocr'
          ? '/api/ocr/ocr-only'
          : mode === 'layout'
            ? '/api/ocr/layout-only'
            : '/api/ocr';

      const ocrResponse = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!ocrResponse.ok) {
        const errorData = await ocrResponse.json();
        throw new Error(
          errorData.details || errorData.error || 'OCR処理に失敗しました'
        );
      }

      const ocrData: NormalizedOcr = await ocrResponse.json();
      console.log('[OCR Viewer] Received OCR data:', {
        pages: ocrData.pages?.length,
        totalBlocks: ocrData.pages?.reduce(
          (sum, p) => sum + p.blocks.length,
          0
        ),
        firstPage: ocrData.pages?.[0]
          ? {
              blocks: ocrData.pages[0].blocks.length,
              size: `${ocrData.pages[0].widthPx}x${ocrData.pages[0].heightPx}`,
            }
          : null,
      });
      setOcr(ocrData);

      // 画像URLを生成（プレビュー用）
      if (file.type === 'application/pdf') {
        const urls = await generatePdfPreview(file);
        setImageUrls(urls);
      } else if (file.type.startsWith('image/')) {
        setImageUrls([URL.createObjectURL(file)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // フィールド検出（AI）は今回無効化

  const drawBBoxes = (page: NormalizedPage, imageUrl: string) => {
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
            ? 'rgba(239, 68, 68, 1)' // 選択時は赤で強調
            : 'rgba(59, 130, 246, 0.8)'; // 通常は青
          ctx.lineWidth = isSelected ? 4 : 2;
          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(59, 130, 246, 0.95)';

          const x = block.bbox.x * img.width;
          const y = block.bbox.y * img.height;
          const w = block.bbox.w * img.width;
          const h = block.bbox.h * img.height;
          ctx.strokeRect(x, y, w, h);

          // 選択時は半透明の塗りつぶしも追加
          if (isSelected) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(x, y, w, h);
          }

          // bbox値を表示
          const bboxText = `[${block.bbox.x.toFixed(3)}, ${block.bbox.y.toFixed(3)}, ${block.bbox.w.toFixed(3)}, ${block.bbox.h.toFixed(3)}]`;
          const textY = y > 15 ? y - 3 : y + 12;

          // 背景を描画
          const textMetrics = ctx.measureText(bboxText);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(x, textY - 10, textMetrics.width + 4, 14);

          // テキストを描画
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
            ? 'rgba(239, 68, 68, 1)' // 選択時は赤で強調
            : 'rgba(249, 115, 22, 0.8)'; // 通常はオレンジ
          ctx.lineWidth = isSelected ? 5 : 3;
          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(249, 115, 22, 0.9)';

          const x = table.bbox.x * img.width;
          const y = table.bbox.y * img.height;
          const w = table.bbox.w * img.width;
          const h = table.bbox.h * img.height;

          // テーブル全体の枠
          ctx.strokeRect(x, y, w, h);

          // 選択時は半透明の塗りつぶしも追加
          if (isSelected) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(x, y, w, h);
          }

          // テーブル情報を表示
          const tableLabel = `Table ${table.rows}x${table.cols}`;
          const labelY = y > 35 ? y - 22 : y + h + 20;

          // 背景を描画
          const labelMetrics = ctx.measureText(tableLabel);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(x, labelY - 12, labelMetrics.width + 4, 16);

          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(249, 115, 22, 0.9)';
          ctx.fillText(tableLabel, x + 2, labelY);

          // bbox値を表示
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

          // セルの格子を描画
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
            ? 'rgba(239, 68, 68, 1)' // 選択時は赤で強調
            : 'rgba(34, 197, 94, 0.8)'; // 通常は緑
          ctx.lineWidth = isSelected ? 5 : 3;
          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(34, 197, 94, 0.9)';

          const x = figure.bbox.x * img.width;
          const y = figure.bbox.y * img.height;
          const w = figure.bbox.w * img.width;
          const h = figure.bbox.h * img.height;
          ctx.strokeRect(x, y, w, h);

          // 選択時は半透明の塗りつぶしも追加
          if (isSelected) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(x, y, w, h);
          }

          // 図表情報を表示
          const figureLabel = `Figure: ${figure.figureType}`;
          const labelY = y > 35 ? y - 22 : y + h + 20;

          // 背景を描画
          const labelMetrics = ctx.measureText(figureLabel);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(x, labelY - 12, labelMetrics.width + 4, 16);

          ctx.fillStyle = isSelected
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(34, 197, 94, 0.9)';
          ctx.fillText(figureLabel, x + 2, labelY);

          // bbox値を表示
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
    };
    img.src = imageUrl;
  };

  // Canvasへの描画はブラウザのCanvas APIと同期するための副作用
  useEffect(() => {
    if (!ocr || imageUrls.length === 0) return;
    if (selectedPage >= ocr.pages.length) return;
    if (!imageUrls[selectedPage]) return;
    const page = ocr.pages[selectedPage];
    if (page) {
      drawBBoxes(page, imageUrls[selectedPage]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ocr,
    imageUrls,
    selectedPage,
    showBlocks,
    showTables,
    showFigures,
    selectedBlock,
  ]);

  return (
    <div className='min-h-screen bg-background text-foreground'>
      <div className='container mx-auto p-6'>
        {/* Upload Section - Compact */}
        <div className='bg-card text-card-foreground rounded-lg border p-3 mb-6'>
          <div className='flex flex-wrap items-center gap-3'>
            {/* Mode Selection */}
            <div className='inline-flex items-center rounded-md border'>
              <button
                onClick={() => setMode('ocr')}
                className={`px-3 py-2 text-sm ${mode === 'ocr' ? 'bg-primary text-primary-foreground' : ''}`}
              >
                文字位置（OCR）
              </button>
              <button
                onClick={() => setMode('layout')}
                className={`px-3 py-2 text-sm border-l ${mode === 'layout' ? 'bg-primary text-primary-foreground' : ''}`}
              >
                レイアウト構造
              </button>
              <button
                onClick={() => setMode('document')}
                className={`px-3 py-2 text-sm border-l ${mode === 'document' ? 'bg-primary text-primary-foreground' : ''}`}
              >
                統合（Document）
              </button>
            </div>

            {/* File Upload */}
            <div className='flex-1 min-w-[200px]'>
              <input
                type='file'
                accept='.pdf,.png,.jpg,.jpeg'
                onChange={handleFileChange}
                className='hidden'
                id='file-upload'
              />
              <label
                htmlFor='file-upload'
                className='cursor-pointer inline-flex items-center gap-2 px-3 py-2 border border-dashed rounded-md hover:bg-muted/50 transition-colors'
              >
                <svg
                  className='w-4 h-4 text-muted-foreground'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
                  />
                </svg>
                <span className='text-sm truncate'>
                  {file ? file.name : 'ファイルを選択...'}
                </span>
              </label>
            </div>

            {/* Execute Button */}
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className='px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            >
              {loading ? (
                <span className='flex items-center gap-2'>
                  <svg
                    className='animate-spin h-4 w-4'
                    xmlns='http://www.w3.org/2000/svg'
                    fill='none'
                    viewBox='0 0 24 24'
                  >
                    <circle
                      className='opacity-25 stroke-current'
                      cx='12'
                      cy='12'
                      r='10'
                      strokeWidth='4'
                    ></circle>
                    <path
                      className='opacity-75 fill-current'
                      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                    ></path>
                  </svg>
                  処理中...
                </span>
              ) : (
                '🚀 実行'
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className='mb-6 p-4 bg-destructive/10 border-l-4 border-destructive rounded-lg'>
            <div className='flex items-start'>
              <svg
                className='w-5 h-5 text-destructive mt-0.5 mr-3'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
              <div>
                <h3 className='text-sm font-medium text-destructive'>Error</h3>
                <p className='text-sm text-destructive/90 mt-1'>{error}</p>
              </div>
            </div>
          </div>
        )}

        {ocr && (
          <div className='bg-card text-card-foreground rounded-lg border p-5 mb-6'>
            <div className='flex flex-col gap-4 mb-6'>
              <div className='flex items-center justify-between flex-wrap gap-3'>
                <h2 className='text-xl font-bold'>結果を表示</h2>
                <div className='flex items-center gap-3'>
                  <SchemaExportButton
                    blocks={ocr.pages[selectedPage]?.blocks || []}
                    disabled={!ocr.pages[selectedPage]?.blocks.length}
                  />
                  <FieldSchemaDetectButton
                    ocr={ocr}
                    imageUrl={imageUrls[selectedPage] || null}
                    selectedPage={selectedPage}
                    disabled={
                      !ocr.pages[selectedPage] || !imageUrls[selectedPage]
                    }
                  />
                  <div className='flex items-center gap-2'>
                    <label className='text-sm font-medium text-muted-foreground'>
                      Page:
                    </label>
                    <select
                      value={selectedPage}
                      onChange={(e) => setSelectedPage(Number(e.target.value))}
                      className='border border-input rounded-md px-3 py-1.5 text-sm bg-background'
                    >
                      {ocr.pages.map((_, idx) => (
                        <option key={idx} value={idx}>
                          {idx + 1} / {ocr.pages.length}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Overlay Toggles */}
              <div className='flex items-center gap-4 text-sm'>
                <span className='text-muted-foreground font-medium'>表示:</span>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={showBlocks}
                    onChange={(e) => setShowBlocks(e.target.checked)}
                    className='rounded border-input'
                  />
                  <span>Blocks</span>
                </label>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={showTables}
                    onChange={(e) => setShowTables(e.target.checked)}
                    className='rounded border-input'
                  />
                  <span>Tables</span>
                </label>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={showFigures}
                    onChange={(e) => setShowFigures(e.target.checked)}
                    className='rounded border-input'
                  />
                  <span>Figures</span>
                </label>
              </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              {/* Canvas Preview */}
              <div className='bg-muted/30 rounded-lg p-4 border'>
                <h3 className='text-base font-semibold mb-3'>プレビュー</h3>
                <div className='bg-background rounded border overflow-hidden'>
                  <canvas
                    ref={canvasRef}
                    className='w-full'
                    style={{ maxHeight: '600px', objectFit: 'contain' }}
                  />
                </div>
                <div className='mt-3 flex gap-3 text-xs text-muted-foreground'>
                  <span className='flex items-center gap-1.5'>
                    <span className='w-2.5 h-2.5 bg-blue-500 rounded'></span>
                    Blocks
                  </span>
                  <span className='flex items-center gap-1.5'>
                    <span className='w-2.5 h-2.5 bg-orange-500 rounded'></span>
                    Tables
                  </span>
                  <span className='flex items-center gap-1.5'>
                    <span className='w-2.5 h-2.5 bg-green-500 rounded'></span>
                    Figures
                  </span>
                </div>
              </div>

              {/* Content Details - Tabbed */}
              <div className='bg-muted/30 rounded-lg border flex flex-col h-[600px]'>
                {ocr.pages[selectedPage] && (
                  <>
                    {/* Tab Header */}
                    <div className='flex border-b bg-background'>
                      <button
                        onClick={() => setActiveTab('blocks')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                          activeTab === 'blocks'
                            ? 'bg-muted border-b-2 border-primary text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <div className='flex items-center justify-center gap-2'>
                          📄 Blocks
                          <span className='text-xs bg-muted px-2 py-0.5 rounded-full'>
                            {ocr.pages[selectedPage].blocks.length}
                          </span>
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveTab('tables')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                          activeTab === 'tables'
                            ? 'bg-muted border-b-2 border-primary text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <div className='flex items-center justify-center gap-2'>
                          📊 Tables
                          <span className='text-xs bg-muted px-2 py-0.5 rounded-full'>
                            {ocr.pages[selectedPage].tables?.length || 0}
                          </span>
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveTab('figures')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                          activeTab === 'figures'
                            ? 'bg-muted border-b-2 border-primary text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <div className='flex items-center justify-center gap-2'>
                          🖼️ Figures
                          <span className='text-xs bg-muted px-2 py-0.5 rounded-full'>
                            {ocr.pages[selectedPage].figures?.length || 0}
                          </span>
                        </div>
                      </button>
                    </div>

                    {/* Tab Content */}
                    <div className='flex-1 overflow-y-auto p-4'>
                      {/* Blocks Tab */}
                      {activeTab === 'blocks' && (
                        <div className='space-y-2'>
                          {ocr.pages[selectedPage].blocks.map((block, idx) => {
                            const isSelected =
                              selectedBlock?.type === 'block' &&
                              selectedBlock.index === idx;
                            return (
                              <div
                                key={idx}
                                onClick={() =>
                                  setSelectedBlock({
                                    type: 'block',
                                    index: idx,
                                  })
                                }
                                className={`p-3 rounded border text-sm cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-red-50 border-red-500 ring-2 ring-red-200'
                                    : 'bg-background hover:bg-muted/50'
                                }`}
                              >
                                <div className='flex items-start gap-2'>
                                  <span className='text-xs font-mono bg-muted px-1.5 py-0.5 rounded'>
                                    {idx}
                                  </span>
                                  <div className='flex-1'>
                                    <div className='text-xs text-muted-foreground font-medium mb-1'>
                                      {block.blockType}
                                    </div>
                                    <div className='line-clamp-2'>
                                      {block.text || '(empty)'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Tables Tab */}
                      {activeTab === 'tables' && (
                        <div className='space-y-2'>
                          {ocr.pages[selectedPage].tables &&
                          ocr.pages[selectedPage].tables!.length > 0 ? (
                            ocr.pages[selectedPage].tables!.map(
                              (table, idx) => {
                                const isSelected =
                                  selectedBlock?.type === 'table' &&
                                  selectedBlock.index === idx;
                                return (
                                  <div
                                    key={idx}
                                    onClick={() =>
                                      setSelectedBlock({
                                        type: 'table',
                                        index: idx,
                                      })
                                    }
                                    className={`p-3 rounded border cursor-pointer transition-all ${
                                      isSelected
                                        ? 'bg-red-50 border-red-500 ring-2 ring-red-200'
                                        : 'bg-background hover:bg-muted/50'
                                    }`}
                                  >
                                    <div className='flex items-center gap-2 text-sm'>
                                      <span className='text-xs font-mono bg-muted px-1.5 py-0.5 rounded'>
                                        {idx}
                                      </span>
                                      <span className='font-medium'>
                                        {table.rows} rows × {table.cols} cols
                                      </span>
                                      <span className='text-xs text-muted-foreground'>
                                        ({table.cells.length} cells)
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                            )
                          ) : (
                            <div className='text-center text-muted-foreground py-8'>
                              テーブルが検出されませんでした
                            </div>
                          )}
                        </div>
                      )}

                      {/* Figures Tab */}
                      {activeTab === 'figures' && (
                        <div className='space-y-2'>
                          {ocr.pages[selectedPage].figures &&
                          ocr.pages[selectedPage].figures!.length > 0 ? (
                            ocr.pages[selectedPage].figures!.map(
                              (figure, idx) => {
                                const isSelected =
                                  selectedBlock?.type === 'figure' &&
                                  selectedBlock.index === idx;
                                return (
                                  <div
                                    key={idx}
                                    onClick={() =>
                                      setSelectedBlock({
                                        type: 'figure',
                                        index: idx,
                                      })
                                    }
                                    className={`p-3 rounded border cursor-pointer transition-all ${
                                      isSelected
                                        ? 'bg-red-50 border-red-500 ring-2 ring-red-200'
                                        : 'bg-background hover:bg-muted/50'
                                    }`}
                                  >
                                    <div className='flex items-center gap-2 text-sm'>
                                      <span className='text-xs font-mono bg-muted px-1.5 py-0.5 rounded'>
                                        {idx}
                                      </span>
                                      <span>{figure.figureType}</span>
                                    </div>
                                  </div>
                                );
                              }
                            )
                          ) : (
                            <div className='text-center text-muted-foreground py-8'>
                              図表が検出されませんでした
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Fields section removed - focus on OCR quality first */}
      </div>
    </div>
  );
}
