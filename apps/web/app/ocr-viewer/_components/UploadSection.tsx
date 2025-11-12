'use client';

import { Button } from '@workspace/ui/components/button';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';

type OcrMode = 'ocr' | 'layout' | 'segment';

interface UploadSectionProps {
  file: File | null;
  loading: boolean;
  mode?: OcrMode;
  showModeSelector?: boolean;
  onFileChange: (file: File | null) => void;
  onModeChange?: (mode: OcrMode) => void;
  onExecute: () => void;
  executeLabel?: string;
}

export function UploadSection({
  file,
  loading,
  mode = 'ocr',
  showModeSelector = false,
  onFileChange,
  onModeChange,
  onExecute,
  executeLabel,
}: UploadSectionProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    onFileChange(selectedFile || null);
  };

  const defaultLabel = loading
    ? '処理中...'
    : mode === 'layout'
      ? 'レイアウト解析を実行'
      : mode === 'segment'
        ? 'セグメント処理'
        : 'OCR実行';

  return (
    <div className='mb-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <Button variant='ghost' size='sm' asChild>
          <Link href='/'>
            <ArrowLeftIcon className='w-4 h-4' />
          </Link>
        </Button>

        {/* Mode Selection (optional) */}
        {showModeSelector && onModeChange && (
          <div className='inline-flex items-center rounded-md border'>
            <button
              onClick={() => onModeChange('ocr')}
              className={`px-3 py-2 text-sm ${mode === 'ocr' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              文字位置（OCR）
            </button>
            <button
              onClick={() => onModeChange('layout')}
              className={`px-3 py-2 text-sm border-l ${mode === 'layout' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              レイアウト構造
            </button>
            <button
              onClick={() => onModeChange('segment')}
              className={`px-3 py-2 text-sm border-l ${mode === 'segment' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              セグメント
            </button>
          </div>
        )}

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
        <Button onClick={onExecute} disabled={!file || loading} size='lg'>
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
            executeLabel || defaultLabel
          )}
        </Button>
      </div>
    </div>
  );
}

