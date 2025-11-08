'use client';

import { useState, useTransition } from 'react';
import { autoGenerateArticle, exportNoteMarkdown } from '@/app/actions/article';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';

type GenerationStep =
  | 'idle'
  | 'strategy'
  | 'draft'
  | 'qa'
  | 'complete';

interface GenerationResult {
  articleId: string;
  title: string;
  price: number;
  wordCount: { total: number; free: number; paid: number };
  metrics: {
    questionCount: number;
    sectionCount: number;
    checklistItems: number;
  };
  qualityScore: number;
}

interface MarkdownExport {
  free: string;
  paid: string;
  combined: string;
}

export function AutoGeneratePanel() {
  const [theme, setTheme] = useState('');
  const [step, setStep] = useState<GenerationStep>('idle');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [markdown, setMarkdown] = useState<MarkdownExport | null>(null);
  const [activeTab, setActiveTab] = useState<'free' | 'paid' | 'combined'>('combined');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // オプション設定
  const [includeDistribution, setIncludeDistribution] = useState(true);
  const [priceTier, setPriceTier] = useState<'low' | 'standard' | 'premium'>('standard');

  const handleGenerate = () => {
    if (!theme.trim()) {
      setError('テーマを入力してください');
      return;
    }

    setError(null);
    setStep('strategy');

    // Server Actionを呼び出す（外部同期）
    startTransition(async () => {
      try {
        // 戦略生成
        setStep('strategy');
        await new Promise((resolve) => setTimeout(resolve, 500)); // UI更新のため

        // ドラフト生成
        setStep('draft');
        await new Promise((resolve) => setTimeout(resolve, 500));

        // QA
        setStep('qa');
        
        const generateResult = await autoGenerateArticle(theme, {
          includeDistribution,
          priceTier,
        });

        if (!generateResult.success || !generateResult.articleId) {
          throw new Error(generateResult.error || '生成に失敗しました');
        }

        setResult(generateResult.result as GenerationResult);

        // Markdownをエクスポート
        const exportResult = await exportNoteMarkdown(generateResult.articleId);

        if (!exportResult.success) {
          throw new Error(exportResult.error || 'エクスポートに失敗しました');
        }

        setMarkdown(exportResult.markdown as MarkdownExport);
        setStep('complete');
      } catch (err: any) {
        setError(err.message || '記事の生成に失敗しました');
        setStep('idle');
      }
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: トースト通知を表示
  };

  const handleReset = () => {
    setStep('idle');
    setResult(null);
    setMarkdown(null);
    setTheme('');
    setError(null);
  };

  if (step === 'idle') {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">note記事を全自動で作成</h2>
          <p className="text-gray-600">
            テーマを入力するだけで、売れるnote記事を自動生成します。
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              記事のテーマ
            </label>
            <Input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="例: noteで月5万円稼ぐ方法"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">オプション</label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeDistribution}
                  onChange={(e) => setIncludeDistribution(e.target.checked)}
                  className="mr-2"
                />
                X投稿文を生成
              </label>
            </div>
            <div>
              <label className="block text-sm mb-1">価格帯</label>
              <select
                value={priceTier}
                onChange={(e) => setPriceTier(e.target.value as any)}
                className="border rounded px-3 py-2"
              >
                <option value="low">低価格（500-800円）</option>
                <option value="standard">標準（1,000-1,500円）</option>
                <option value="premium">プレミアム（2,000円〜）</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
              {error}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={isPending || !theme.trim()}
            className="w-full"
          >
            {isPending ? '生成中...' : '全自動で作成'}
          </Button>
        </div>
      </div>
    );
  }

  if (step !== 'complete') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">記事を生成中...</h2>
          <div className="space-y-2">
            <div className={`flex items-center space-x-2 ${step === 'strategy' ? 'text-blue-600' : step === 'draft' || step === 'qa' || step === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center">
                {step === 'strategy' ? '⏳' : '✓'}
              </div>
              <span>戦略策定（競合分析・USP・構成案）</span>
            </div>
            <div className={`flex items-center space-x-2 ${step === 'draft' ? 'text-blue-600' : step === 'qa' || step === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center">
                {step === 'draft' ? '⏳' : step === 'qa' || step === 'complete' ? '✓' : '○'}
              </div>
              <span>ドラフト生成（各セクション執筆）</span>
            </div>
            <div className={`flex items-center space-x-2 ${step === 'qa' ? 'text-blue-600' : step === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center">
                {step === 'qa' ? '⏳' : step === 'complete' ? '✓' : '○'}
              </div>
              <span>品質チェック＆価格設定</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">生成完了！</h2>
        <Button onClick={handleReset} variant="outline">
          新しい記事を作成
        </Button>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded p-4 space-y-2">
          <h3 className="font-bold text-lg">{result.title}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">価格</div>
              <div className="font-bold">¥{result.price}</div>
            </div>
            <div>
              <div className="text-gray-600">文字数</div>
              <div className="font-bold">{result.wordCount.total.toLocaleString()}字</div>
            </div>
            <div>
              <div className="text-gray-600">セクション数</div>
              <div className="font-bold">{result.metrics.sectionCount}</div>
            </div>
            <div>
              <div className="text-gray-600">品質スコア</div>
              <div className="font-bold">{result.qualityScore}/100</div>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="flex space-x-2 border-b mb-4">
          <button
            onClick={() => setActiveTab('combined')}
            className={`px-4 py-2 ${activeTab === 'combined' ? 'border-b-2 border-blue-600 font-bold' : 'text-gray-600'}`}
          >
            結合版（[PAYWALL]マーカー入り）
          </button>
          <button
            onClick={() => setActiveTab('free')}
            className={`px-4 py-2 ${activeTab === 'free' ? 'border-b-2 border-blue-600 font-bold' : 'text-gray-600'}`}
          >
            無料部分のみ
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            className={`px-4 py-2 ${activeTab === 'paid' ? 'border-b-2 border-blue-600 font-bold' : 'text-gray-600'}`}
          >
            有料部分のみ
          </button>
        </div>

        {markdown && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => handleCopy(markdown[activeTab])}
                variant="outline"
              >
                📋 クリップボードにコピー
              </Button>
            </div>
            <pre className="bg-gray-50 border rounded p-4 overflow-auto max-h-96 text-sm whitespace-pre-wrap">
              {markdown[activeTab]}
            </pre>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-bold mb-2">次のステップ</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>上記のMarkdownをnoteの記事作成画面にコピー＆ペースト</li>
          <li>[PAYWALL]マーカーの位置で有料設定を行う</li>
          <li>画像やリンクを追加して仕上げる</li>
          <li>公開！</li>
        </ol>
      </div>
    </div>
  );
}

