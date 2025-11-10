'use client';

import { useState } from 'react';
import {
  manyBboxesToTextSchemas,
  type PdfmeTextSchema,
  type NormalizedBlock,
} from '@workspace/ai/src/ocr';

interface SchemaExportButtonProps {
  blocks: NormalizedBlock[];
  disabled?: boolean;
}

export function SchemaExportButton({
  blocks,
  disabled,
}: SchemaExportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [schemas, setSchemas] = useState<PdfmeTextSchema[]>([]);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    // blocksをpdfme TextSchemaに変換
    const items = blocks.map((block, idx) => ({
      bbox: block.bbox,
      text: block.text,
      name: `field${idx + 1}`,
    }));

    const generatedSchemas = manyBboxesToTextSchemas(items);
    setSchemas(generatedSchemas);
    setShowModal(true);
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
    a.download = `pdfme-schemas-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={disabled || blocks.length === 0}
        className='px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
      >
        📄 pdfme TextSchema生成
      </button>

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
                pdfme TextSchema ({schemas.length}件)
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
              <pre className='bg-muted/50 rounded-lg p-4 text-xs overflow-x-auto'>
                <code>{JSON.stringify(schemas, null, 2)}</code>
              </pre>
            </div>

            {/* Footer Actions */}
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
                className='px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2'
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
          </div>
        </div>
      )}
    </>
  );
}
