'use client';

import type { PdfmeTextSchema } from '@workspace/ai/src/ocr';
import { useCallback, useState } from 'react';
import type { Segment, SegmentResult } from '../_hooks/useSegments';
import {
  downloadSegmentPdf,
  generateSegmentPdf,
} from '../_utils/generateSegmentPdf';
import { Button } from '@workspace/ui/components/button';

interface SegmentRunPanelProps {
  file: File | null;
  segments: Segment[];
  results: Map<string, SegmentResult>;
  onResultUpdate: (id: string, result: Partial<SegmentResult>) => void;
  onSegmentSelect: (id: string | null) => void;
  selectedId: string | null;
  onSegmentDelete: (id: string) => void;
}

export function SegmentRunPanel({
  file,
  segments,
  results,
  onResultUpdate,
  onSegmentSelect,
  selectedId,
  onSegmentDelete,
}: SegmentRunPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedSegmentId, setExpandedSegmentId] = useState<string | null>(
    null
  );

  // セグメント→スキーマ生成の状態
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [detectedSchemas, setDetectedSchemas] = useState<
    PdfmeTextSchema[] | null
  >(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);

  // 直列でOCR実行
  const handleRunOcr = useCallback(async () => {
    if (!file || segments.length === 0) return;

    setIsRunning(true);
    setError(null);
    setCurrentIndex(0);

    try {
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (!segment) {
          console.warn(`Segment at index ${i} is undefined, skipping`);
          continue;
        }

        setCurrentIndex(i);

        // ステータスを処理中に更新
        onResultUpdate(segment.id, { status: 'processing' });

        try {
          // セグメントPDFを生成
          const pdfBlob = await generateSegmentPdf({
            file,
            pageIndex: segment.page,
            segment,
            dpi: 300,
          });

          // OCR APIに送信
          const formData = new FormData();
          formData.append(
            'file',
            new File([pdfBlob], `segment-${segment.id}.pdf`, {
              type: 'application/pdf',
            })
          );
          formData.append('dpi', '300');

          const response = await fetch('/api/ocr/ocr-only', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.details || errorData.error || 'OCR処理に失敗しました'
            );
          }

          const ocrResult = await response.json();

          // 結果を保存
          onResultUpdate(segment.id, {
            status: 'success',
            pdfBlob,
            ocrResult,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          onResultUpdate(segment.id, {
            status: 'error',
            error: errorMsg,
          });
          // エラー時は処理を停止
          setError(
            `セグメント ${i + 1} の処理中にエラーが発生しました: ${errorMsg}`
          );
          break;
        }
      }
    } finally {
      setIsRunning(false);
    }
  }, [file, segments, onResultUpdate]);

  // 個別のセグメントPDFをダウンロード
  const handleDownloadPdf = useCallback(
    (segmentId: string) => {
      const result = results.get(segmentId);
      if (result?.pdfBlob) {
        downloadSegmentPdf(result.pdfBlob, `segment-${segmentId}.pdf`);
      }
    },
    [results]
  );

  // OCR結果をテキストとしてダウンロード
  const handleDownloadOcrText = useCallback(
    (segmentId: string) => {
      const result = results.get(segmentId);
      if (result?.ocrResult) {
        const text = extractTextFromOcr(result.ocrResult);
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `segment-${segmentId}-ocr.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    },
    [results]
  );

  // OCR結果からテキストを抽出
  const extractTextFromOcr = (ocrResult: any): string => {
    if (!ocrResult?.pages) return '';
    return ocrResult.pages
      .map((page: any) => {
        return (
          page.blocks?.map((block: any) => block.text || '').join('\n') || ''
        );
      })
      .join('\n\n');
  };

  // セグメント→スキーマ生成を実行
  const handleDetectFields = useCallback(async () => {
    if (!file || segments.length === 0) return;

    // OCR実行済みのセグメントのみを対象とする
    const segmentsWithOcr = segments.filter((seg) => {
      const result = results.get(seg.id);
      return result?.status === 'success' && result?.ocrResult;
    });

    if (segmentsWithOcr.length === 0) {
      setDetectError(
        'OCR実行済みのセグメントがありません。先に「OCR実行」ボタンを押してください。'
      );
      return;
    }

    setIsDetecting(true);
    setDetectError(null);
    setDetectedSchemas(null);

    try {
      // セグメントのOCR結果と画像を準備
      const segmentOcrResults = await Promise.all(
        segmentsWithOcr.map(async (seg, idx) => {
          const result = results.get(seg.id);

          // セグメントPDFから画像を生成
          let imageBase64: string | undefined = undefined;
          if (result?.pdfBlob) {
            try {
              const pdfBlob = result.pdfBlob;
              const arrayBuffer = await pdfBlob.arrayBuffer();

              // PDFをCanvasに描画して画像化
              const pdfjsLib = await import('pdfjs-dist');
              const loadingTask = pdfjsLib.getDocument({
                data: arrayBuffer,
              });
              const pdfDoc = await loadingTask.promise;
              const page = await pdfDoc.getPage(1);

              const viewport = page.getViewport({ scale: 2.0 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              if (!context) throw new Error('Canvas context not available');

              canvas.width = viewport.width;
              canvas.height = viewport.height;

              await page.render({
                canvasContext: context,
                viewport,
              } as any).promise;

              imageBase64 = canvas.toDataURL('image/png');
              console.log(
                `[SegmentRunPanel] Generated image for segment ${idx}`
              );
            } catch (imgErr) {
              console.warn(
                `[SegmentRunPanel] Failed to generate image for segment ${idx}:`,
                imgErr
              );
            }
          }

          return {
            segmentIndex: idx,
            ocr: result!.ocrResult,
            image: imageBase64,
            pageIndex: seg.page,
            bboxNormalized: {
              x: seg.nx,
              y: seg.ny,
              w: seg.nw,
              h: seg.nh,
            },
          };
        })
      );

      console.log(
        '[SegmentRunPanel] Sending segment detect request with',
        segmentOcrResults.length,
        'OCR results',
        segmentOcrResults.filter((r) => r.image).length,
        'with images'
      );

      // APIを呼び出し（JSONで送信）
      const response = await fetch('/api/ocr/segment-detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          segmentOcrResults,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || errorData.error || 'セグメント検出に失敗しました'
        );
      }

      const result = await response.json();
      console.log(
        '[SegmentRunPanel] Detected schemas:',
        result.pdfmeSchemas?.length
      );
      console.log('[SegmentRunPanel] Metadata:', result.metadata);

      setDetectedSchemas(result.pdfmeSchemas || []);
      setShowSchemaModal(true);
    } catch (err) {
      console.error('[SegmentRunPanel] Detection error:', err);
      setDetectError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDetecting(false);
    }
  }, [file, segments, results]);

  // スキーマをコピー
  const handleCopySchemas = useCallback(async () => {
    if (!detectedSchemas) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(detectedSchemas, null, 2)
      );
      setSchemaCopied(true);
      setTimeout(() => setSchemaCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy schemas:', err);
    }
  }, [detectedSchemas]);

  // スキーマをダウンロード
  const handleDownloadSchemas = useCallback(() => {
    if (!detectedSchemas) return;
    const blob = new Blob([JSON.stringify(detectedSchemas, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `segment-schemas-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [detectedSchemas]);

  // ステータスバッジの色
  const getStatusColor = (status: SegmentResult['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-200 text-gray-700';
      case 'processing':
        return 'bg-blue-200 text-blue-700';
      case 'success':
        return 'bg-green-200 text-green-700';
      case 'error':
        return 'bg-red-200 text-red-700';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  // ステータスラベル
  const getStatusLabel = (status: SegmentResult['status']) => {
    switch (status) {
      case 'pending':
        return '待機中';
      case 'processing':
        return '処理中';
      case 'success':
        return '完了';
      case 'error':
        return 'エラー';
      default:
        return '不明';
    }
  };

  return (
    <div className='bg-card text-card-foreground rounded-lg border p-5'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-semibold'>セグメント一覧</h3>
        <div className='flex gap-2'>
          <Button
            onClick={handleRunOcr}
            disabled={isRunning || !file || segments.length === 0}
            variant='outline'
          >
            {isRunning
              ? `処理中 (${currentIndex + 1}/${segments.length})`
              : 'OCR実行'}
          </Button>
          <Button
            onClick={handleDetectFields}
            disabled={isDetecting || !file || segments.length === 0}
            variant='default'
          >
            {isDetecting ? (
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
                検出中...
              </span>
            ) : (
              'スキーマ生成'
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm'>
          {error}
        </div>
      )}

      {detectError && (
        <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm'>
          <strong>スキーマ検出エラー:</strong> {detectError}
        </div>
      )}

      {segments.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          セグメントがありません。画像上をドラッグして矩形を作成してください。
        </p>
      ) : (
        <div className='space-y-2'>
          {segments.map((segment, index) => {
            const result = results.get(segment.id);
            const status = result?.status || 'pending';
            const isSelected = selectedId === segment.id;

            return (
              <div
                key={segment.id}
                className={`border rounded-md p-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => onSegmentSelect(segment.id)}
              >
                <div className='flex items-center justify-between mb-2'>
                  <div className='flex items-center gap-2'>
                    <span className='font-medium text-sm'>
                      セグメント {index + 1}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(status)}`}
                    >
                      {getStatusLabel(status)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSegmentDelete(segment.id);
                    }}
                    className='text-red-600 hover:text-red-800 text-sm'
                  >
                    削除
                  </button>
                </div>

                <div className='text-xs text-muted-foreground mb-2'>
                  ページ: {segment.page + 1} | 位置: (
                  {(segment.nx * 100).toFixed(1)}%,{' '}
                  {(segment.ny * 100).toFixed(1)}%) | サイズ:{' '}
                  {(segment.nw * 100).toFixed(1)}% ×{' '}
                  {(segment.nh * 100).toFixed(1)}%
                </div>

                {status === 'error' && result?.error && (
                  <div className='text-xs text-red-600 mb-2'>
                    {result.error}
                  </div>
                )}

                {status === 'success' && (
                  <div className='flex gap-2 mt-2'>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPdf(segment.id);
                      }}
                      className='text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors'
                    >
                      PDF DL
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadOcrText(segment.id);
                      }}
                      className='text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors'
                    >
                      テキスト DL
                    </button>
                  </div>
                )}

                {status === 'success' && result?.ocrResult && (
                  <div className='mt-2 p-2 bg-gray-50 rounded text-xs max-h-32 overflow-y-auto'>
                    <div className='font-medium mb-1'>OCR結果プレビュー:</div>
                    <div className='text-muted-foreground whitespace-pre-wrap'>
                      {extractTextFromOcr(result.ocrResult).slice(0, 200)}
                      {extractTextFromOcr(result.ocrResult).length > 200 &&
                        '...'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* スキーマ結果モーダル */}
      {showSchemaModal && detectedSchemas && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col'>
            {/* ヘッダー */}
            <div className='flex items-center justify-between p-6 border-b'>
              <h3 className='text-xl font-semibold'>セグメント統合スキーマ</h3>
              <button
                onClick={() => setShowSchemaModal(false)}
                className='text-gray-500 hover:text-gray-700 text-2xl leading-none'
              >
                ×
              </button>
            </div>

            {/* コンテンツ */}
            <div className='flex-1 overflow-y-auto p-6'>
              <div className='mb-4 text-sm text-gray-600'>
                <p>
                  検出されたフィールド数:{' '}
                  <strong>{detectedSchemas.length}</strong>
                </p>
                <p className='mt-1 text-xs'>
                  各セグメントから検出されたフィールドが統合されています。
                </p>
              </div>

              <pre className='bg-gray-50 p-4 rounded-md overflow-x-auto text-xs border'>
                {JSON.stringify(detectedSchemas, null, 2)}
              </pre>
            </div>

            {/* フッター */}
            <div className='flex items-center justify-end gap-3 p-6 border-t bg-gray-50'>
              <Button onClick={handleCopySchemas} variant='secondary'>
                {schemaCopied ? '✓ コピーしました' : 'クリップボードにコピー'}
              </Button>
              <Button onClick={handleDownloadSchemas}>JSONダウンロード</Button>
              <Button
                onClick={() => setShowSchemaModal(false)}
                className='px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm'
              >
                閉じる
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
