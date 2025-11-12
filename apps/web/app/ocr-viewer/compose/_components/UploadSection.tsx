'use client';

import { ChangeEvent } from 'react';
import { Button } from '@workspace/ui/components/button';

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
    <div className='mb-6 p-4 bg-card rounded-lg border'>
      <div className='flex items-center gap-4'>
        <input
          type='file'
          accept='application/pdf,image/png,image/jpeg,image/jpg'
          onChange={onFileChange}
          className='flex-1 text-sm'
        />
        <Button onClick={onRunLayout} disabled={!file || loading} size='lg'>
          {loading ? '解析中...' : 'レイアウト解析を実行'}
        </Button>
      </div>
      {file && (
        <p className='text-sm text-muted-foreground mt-2'>
          選択ファイル: {file.name}
        </p>
      )}
    </div>
  );
}
