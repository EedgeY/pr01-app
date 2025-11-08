'use client';

import { useState } from 'react';
import { ArticleWorkflow } from './_components/ArticleWorkflow';
import { AutoGeneratePanel } from './_components/AutoGeneratePanel';
import { Button } from '@workspace/ui/components/button';

export default function NewArticlePage() {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">note記事作成</h1>
          <div className="flex space-x-2">
            <Button
              onClick={() => setMode('auto')}
              variant={mode === 'auto' ? 'default' : 'outline'}
            >
              🤖 全自動
            </Button>
            <Button
              onClick={() => setMode('manual')}
              variant={mode === 'manual' ? 'default' : 'outline'}
            >
              ✍️ 手動
            </Button>
          </div>
        </div>
      </div>
      
      {mode === 'auto' ? <AutoGeneratePanel /> : <ArticleWorkflow />}
    </div>
  );
}

