'use client';

import { Button } from '@workspace/ui/components/button';
import { useSession } from '@workspace/auth/client';
import Link from 'next/link';

export function GlobalHeader() {
  const { data: session } = useSession();

  return (
    <header className='border-b'>
      <div className='container mx-auto px-4 py-4 flex justify-between items-center'>
        <Link href='/' className='text-2xl font-bold hover:opacity-80'>
          Template Turso Mono
        </Link>
        <div className='flex gap-4 items-center'>
          <Link href='/pricing'>
            <Button variant='outline'>料金プラン</Button>
          </Link>
          {session ? (
            <>
              <Link href='/ocr-viewer'>
                <Button>OCR Viewer</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href='/sign-in?next=/ocr-viewer'>
                <Button>OCR Viewer</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
