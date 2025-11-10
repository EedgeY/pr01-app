'use client';

import { useState } from 'react';
import type { PdfmeTextSchema } from '@workspace/ai/src/ocr';
import type { NormalizedOcr } from '@workspace/ai/src/ocr/types';
import type { DetectedField } from '@workspace/ai';

interface FieldSchemaDetectButtonProps {
  ocr: NormalizedOcr | null;
  imageUrl: string | null;
  selectedPage: number;
  disabled?: boolean;
  onFieldsDetected?: (fields: DetectedField[]) => void;
}

export function FieldSchemaDetectButton({
  ocr,
  imageUrl,
  selectedPage,
  disabled,
  onFieldsDetected,
}: FieldSchemaDetectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [schemas, setSchemas] = useState<PdfmeTextSchema[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertBlobUrlToDataUrl = async (blobUrl: string): Promise<string> => {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleDetect = async () => {
    if (!ocr || !imageUrl) return;

    setLoading(true);
    setError(null);

    try {
      // Convert blob URL to base64 data URL
      const imageDataUrl = await convertBlobUrlToDataUrl(imageUrl);

      // Call API
      const response = await fetch('/api/ocr/detect-fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ocr,
          image: imageDataUrl,
          page: selectedPage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Field detection failed');
      }

      const result = await response.json();
      console.log('[FieldSchemaDetectButton] Detected fields:', result.fields?.length);
      
      setSchemas(result.pdfmeSchemas || []);
      setShowModal(true);
      
      // 親コンポーネントに検出結果を通知
      if (onFieldsDetected && result.fields) {
        onFieldsDetected(result.fields);
      }
    } catch (err) {
      console.error('[FieldSchemaDetectButton] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(schemas, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(schemas, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `field-schemas-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        onClick={handleDetect}
        disabled={disabled || !ocr || !imageUrl || loading}
        className='px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
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
            検出中...
          </span>
        ) : (
          '🤖 入力欄TextSchema生成'
        )}
      </button>

      {error && (
        <div className='fixed bottom-4 right-4 bg-destructive/90 text-destructive-foreground px-4 py-3 rounded-lg shadow-lg max-w-md z-50'>
          <div className='flex items-start gap-2'>
            <svg
              className='w-5 h-5 mt-0.5 shrink-0'
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
              <h4 className='font-medium text-sm'>エラー</h4>
              <p className='text-sm mt-1'>{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className='ml-auto text-destructive-foreground/70 hover:text-destructive-foreground'
            >
              <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                <path
                  fillRule='evenodd'
                  d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                  clipRule='evenodd'
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
          onClick={() => setShowModal(false)}
        >
          <div
            className='bg-card text-card-foreground rounded-lg border max-w-4xl w-full max-h-[80vh] flex flex-col'
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className='flex items-center justify-between p-4 border-b'>
              <h3 className='text-lg font-semibold'>
                🤖 入力欄TextSchema ({schemas.length}件)
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className='text-muted-foreground hover:text-foreground transition-colors'
              >
                <svg
                  className='w-5 h-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>

            {/* JSON Content */}
            <div className='flex-1 overflow-y-auto p-4'>
              {schemas.length > 0 ? (
                <pre className='bg-muted/50 rounded-lg p-4 text-xs overflow-x-auto'>
                  <code>{JSON.stringify(schemas, null, 2)}</code>
                </pre>
              ) : (
                <div className='text-center text-muted-foreground py-8'>
                  入力欄が検出されませんでした
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {schemas.length > 0 && (
              <div className='flex items-center justify-end gap-3 p-4 border-t'>
                <button
                  onClick={handleCopy}
                  className='px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2'
                >
                  {copied ? (
                    <>
                      <svg
                        className='w-4 h-4'
                        fill='currentColor'
                        viewBox='0 0 20 20'
                      >
                        <path
                          fillRule='evenodd'
                          d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                          clipRule='evenodd'
                        />
                      </svg>
                      コピー完了!
                    </>
                  ) : (
                    <>
                      <svg
                        className='w-4 h-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                        />
                      </svg>
                      クリップボードにコピー
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className='px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2'
                >
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                    />
                  </svg>
                  JSONダウンロード
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

