'use client';

import { Button } from '@workspace/ui/components/button';
import Link from 'next/link';

export default function Page() {
  return (
    <div className='min-h-screen bg-background'>
      <main className='container mx-auto px-4'>
        <section className='py-20 text-center'>
          <div className='flex gap-4 justify-center'>
            <Link href='/ocr-viewer'>
              <Button size='lg'>OCR Viewer</Button>
            </Link>
            <Link href='/ocr-viewer/compose'>
              <Button size='lg'>Compose OCR</Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
