'use client';

import { ChangeEvent } from 'react';
import { Button } from '@workspace/ui/components/button';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';

type UploadSectionProps = {
  file: File | null;
  loading: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRunLayout: () => void;
};

export function UploadSection({
  file,
  loading,
  onFileChange,
  onRunLayout,
}: UploadSectionProps) {
  return (
    <div className='mb-4 flex'>
      <div className='flex-1 flex'>
        <Button variant='ghost' size='sm' asChild className='mr-2'>
          <Link href='/'>
            <ArrowLeftIcon className='w-4 h-4' />
          </Link>
        </Button>

        <input
          type='file'
          accept='application/pdf,image/png,image/jpeg,image/jpg'
          onChange={onFileChange}
          className='text-sm'
        />
        {file && (
          <p className='text-sm text-muted-foreground '>
            選択ファイル: {file.name}
          </p>
        )}
      </div>
      <Button onClick={onRunLayout} disabled={!file || loading} size='lg'>
        {loading ? '解析中...' : 'レイアウト解析を実行'}
      </Button>
    </div>
  );
}
