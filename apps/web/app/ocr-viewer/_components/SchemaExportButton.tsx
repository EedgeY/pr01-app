'use client';

import { useState } from 'react';
import {
  manyBboxesToTextSchemas,
  type PdfmeTextSchema,
  type NormalizedBlock,
} from '@workspace/ai/src/ocr';
import { Button } from '@workspace/ui/components/button';
import { CodeXmlIcon, CopyIcon, DownloadIcon } from 'lucide-react';

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
      {/* <Button
        onClick={handleGenerate}
        disabled={disabled || blocks.length === 0}
        variant='outline'
      >
        📄 pdfme TextSchema生成
      </Button> */}

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
              <Button onClick={() => setShowModal(false)} variant='ghost'>
                <CodeXmlIcon className='w-4 h-4' />
              </Button>
            </div>

            {/* JSON Content */}
            <div className='flex-1 overflow-y-auto p-4'>
              <pre className='bg-muted/50 rounded-lg p-4 text-xs overflow-x-auto'>
                <code>{JSON.stringify(schemas, null, 2)}</code>
              </pre>
            </div>

            {/* Footer Actions */}
            <div className='flex items-center justify-end gap-3 p-4 border-t'>
              <Button onClick={handleCopy} variant='default'>
                {copied ? (
                  <>
                    <CopyIcon className='w-4 h-4' />
                    コピー完了!
                  </>
                ) : (
                  <>
                    <CopyIcon className='w-4 h-4' />
                    クリップボードにコピー
                  </>
                )}
              </Button>
              <Button onClick={handleDownload} variant='outline'>
                <DownloadIcon className='w-4 h-4' />
                JSONダウンロード
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
