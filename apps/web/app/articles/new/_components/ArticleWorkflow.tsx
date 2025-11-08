'use client';

import { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  planArticleStrategy,
  refineOutline,
  generateSection,
  finalizeArticle,
} from '@/app/actions/article';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { useSession } from '@workspace/auth/client';

type WorkflowStep =
  | 'start'
  | 'planning'
  | 'review_strategy'
  | 'generate_body'
  | 'finalize'
  | 'completed';

interface Strategy {
  persona?: string;
  competitors?: Array<{ title: string; url: string; summary?: string }>;
  usp?: string;
  outline?: string[];
}

interface Section {
  heading: string;
  body: string;
}

export function ArticleWorkflow() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  // クエリからthemeを取得（副作用なし、レンダー時に直接算出）
  const initialTheme = searchParams.get('theme') ?? '';

  const [step, setStep] = useState<WorkflowStep>('start');
  const [theme, setTheme] = useState(initialTheme);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ステップ1: テーマ入力
  const handleStartPlanning = () => {
    if (!theme.trim()) {
      setError('テーマを入力してください');
      return;
    }

    setError(null);
    setStep('planning');

    // Server Actionを呼び出す（外部同期）
    startTransition(async () => {
      const result = await planArticleStrategy(theme);

      if (result.success && result.draftId && result.strategy) {
        setDraftId(result.draftId);
        setStrategy(result.strategy);
        setStep('review_strategy');
      } else {
        setError(result.error || '戦略の策定に失敗しました');
        setStep('start');
      }
    });
  };

  // ステップ2: 戦略承認
  const handleApproveStrategy = () => {
    setStep('generate_body');
    setCurrentSectionIndex(0);
  };

  // ステップ2: 戦略修正
  const handleRefineStrategy = () => {
    if (!feedback.trim() || !draftId) return;

    setError(null);

    startTransition(async () => {
      const result = await refineOutline(draftId, feedback);

      if (result.success && result.strategy) {
        setStrategy(result.strategy);
        setFeedback('');
      } else {
        setError(result.error || '構成案の修正に失敗しました');
      }
    });
  };

  // ステップ3: セクション生成
  const handleGenerateSection = () => {
    if (!draftId || !strategy?.outline) return;

    setError(null);

    startTransition(async () => {
      const result = await generateSection(draftId, currentSectionIndex);

      if (result.success && result.section) {
        const newSections = [...sections];
        newSections[currentSectionIndex] = result.section;
        setSections(newSections);

        // 次のセクションへ
        if (currentSectionIndex < (strategy.outline?.length || 0) - 1) {
          setCurrentSectionIndex(currentSectionIndex + 1);
        } else {
          setStep('finalize');
        }
      } else {
        setError(result.error || 'セクションの生成に失敗しました');
      }
    });
  };

  // ステップ4: 完成
  const handleFinalize = () => {
    if (!draftId) return;

    setError(null);

    startTransition(async () => {
      const result = await finalizeArticle(draftId);

      if (result.success) {
        setStep('completed');
      } else {
        setError(result.error || '記事の完成に失敗しました');
      }
    });
  };

  // 認証状態ヘッダー
  const renderAuthStatus = () => {
    if (!session) {
      const loginUrl = theme
        ? `/sign-in?next=${encodeURIComponent(`/articles/new?theme=${encodeURIComponent(theme)}`)}`
        : '/sign-in?next=/articles/new';

      return (
        <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6'>
          <p className='text-sm text-yellow-800'>
            💡 ログインすると、記事を保存して後から編集できます。
            <a href={loginUrl} className='ml-2 underline font-medium'>
              ログイン
            </a>
          </p>
        </div>
      );
    }
    return (
      <div className='bg-green-50 border border-green-200 rounded-lg p-4 mb-6'>
        <p className='text-sm text-green-800'>
          ✓ {session.user.name || session.user.email} としてログイン中
        </p>
      </div>
    );
  };

  // ステップ1: テーマ入力UI
  if (step === 'start') {
    return (
      <div className='max-w-2xl mx-auto p-6 space-y-6'>
        {renderAuthStatus()}

        <div className='space-y-2'>
          <h1 className='text-3xl font-bold'>新しい記事を執筆</h1>
          <p className='text-gray-600'>
            記事のテーマを入力してください。AIが戦略を策定します。
          </p>
        </div>

        <div className='space-y-4'>
          <Input
            type='text'
            placeholder='例: Next.js App Routerの使い方'
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleStartPlanning();
              }
            }}
            className='text-lg'
          />

          {error && <div className='text-red-600 text-sm'>{error}</div>}

          <Button
            onClick={handleStartPlanning}
            disabled={!theme.trim() || isPending}
            className='w-full'
          >
            {isPending ? '策定中...' : '執筆を開始'}
          </Button>
        </div>
      </div>
    );
  }

  // ステップ2: 戦略策定中
  if (step === 'planning') {
    return (
      <div className='max-w-2xl mx-auto p-6 space-y-6'>
        <div className='space-y-2'>
          <h2 className='text-2xl font-bold'>AI編集長がリサーチ中です...</h2>
          <p className='text-gray-600'>
            読者ペルソナの定義、競合記事の分析、独自の切り口の特定を行っています。
          </p>
        </div>
        <div className='animate-pulse space-y-3'>
          <div className='h-4 bg-gray-200 rounded w-3/4'></div>
          <div className='h-4 bg-gray-200 rounded w-1/2'></div>
          <div className='h-4 bg-gray-200 rounded w-5/6'></div>
        </div>
      </div>
    );
  }

  // ステップ3: 戦略レビュー
  if (step === 'review_strategy' && strategy) {
    return (
      <div className='max-w-4xl mx-auto p-6 space-y-6'>
        <div className='space-y-2'>
          <h2 className='text-2xl font-bold'>記事戦略レビュー</h2>
          <p className='text-gray-600'>
            AIが提案した戦略を確認してください。修正が必要な場合はフィードバックを入力できます。
          </p>
        </div>

        <div className='space-y-6 bg-gray-50 p-6 rounded-lg'>
          <div>
            <h3 className='font-semibold text-lg mb-2'>読者ペルソナ</h3>
            <p className='text-gray-700'>{strategy.persona}</p>
          </div>

          {strategy.competitors && strategy.competitors.length > 0 && (
            <div>
              <h3 className='font-semibold text-lg mb-2'>競合記事</h3>
              <ul className='space-y-2'>
                {strategy.competitors.map((comp, idx) => (
                  <li key={idx} className='text-sm'>
                    <a
                      href={comp.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-blue-600 hover:underline'
                    >
                      {comp.title}
                    </a>
                    {comp.summary && (
                      <p className='text-gray-600 mt-1'>{comp.summary}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className='font-semibold text-lg mb-2'>独自性（USP）</h3>
            <p className='text-gray-700'>{strategy.usp}</p>
          </div>

          {strategy.outline && strategy.outline.length > 0 && (
            <div>
              <h3 className='font-semibold text-lg mb-2'>記事構成案</h3>
              <ol className='list-decimal list-inside space-y-1'>
                {strategy.outline.map((heading, idx) => (
                  <li key={idx} className='text-gray-700'>
                    {heading}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium mb-2'>
              フィードバック（任意）
            </label>
            <Input
              type='text'
              placeholder='例: 構成案の2番目をもっと具体的に'
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>

          {error && <div className='text-red-600 text-sm'>{error}</div>}

          <div className='flex gap-4'>
            <Button
              onClick={handleRefineStrategy}
              disabled={!feedback.trim() || isPending}
              variant='outline'
              className='flex-1'
            >
              {isPending ? '修正中...' : '修正して再生成'}
            </Button>
            <Button
              onClick={handleApproveStrategy}
              disabled={isPending}
              className='flex-1'
            >
              この戦略で進める
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ステップ4: 本文生成
  if (step === 'generate_body' && strategy?.outline) {
    const currentHeading = strategy.outline[currentSectionIndex];
    const progress = (
      (currentSectionIndex / strategy.outline.length) *
      100
    ).toFixed(0);

    return (
      <div className='max-w-4xl mx-auto p-6 space-y-6'>
        <div className='space-y-2'>
          <h2 className='text-2xl font-bold'>本文を生成中</h2>
          <p className='text-gray-600'>
            セクション {currentSectionIndex + 1} / {strategy.outline.length}
          </p>
          <div className='w-full bg-gray-200 rounded-full h-2'>
            <div
              className='bg-blue-600 h-2 rounded-full transition-all'
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className='bg-gray-50 p-6 rounded-lg space-y-4'>
          <h3 className='text-xl font-semibold'>{currentHeading}</h3>

          {sections[currentSectionIndex] ? (
            <div className='prose max-w-none'>
              <p className='whitespace-pre-wrap'>
                {sections[currentSectionIndex].body}
              </p>
            </div>
          ) : (
            <div className='text-gray-500 italic'>
              このセクションの本文を生成します...
            </div>
          )}
        </div>

        {error && <div className='text-red-600 text-sm'>{error}</div>}

        <Button
          onClick={handleGenerateSection}
          disabled={isPending || !!sections[currentSectionIndex]}
          className='w-full'
        >
          {isPending
            ? '生成中...'
            : sections[currentSectionIndex]
              ? '次のセクションへ'
              : 'このセクションを生成'}
        </Button>
      </div>
    );
  }

  // ステップ5: 最終確認
  if (step === 'finalize') {
    return (
      <div className='max-w-4xl mx-auto p-6 space-y-6'>
        <div className='space-y-2'>
          <h2 className='text-2xl font-bold'>記事の最終確認</h2>
          <p className='text-gray-600'>生成された記事を確認してください。</p>
        </div>

        <div className='bg-white border rounded-lg p-8 space-y-6'>
          <h1 className='text-3xl font-bold'>{theme}</h1>

          {sections.map((section, idx) => (
            <div key={idx} className='space-y-2'>
              <h2 className='text-2xl font-semibold'>{section.heading}</h2>
              <p className='whitespace-pre-wrap text-gray-700'>
                {section.body}
              </p>
            </div>
          ))}
        </div>

        {error && <div className='text-red-600 text-sm'>{error}</div>}

        <Button
          onClick={handleFinalize}
          disabled={isPending}
          className='w-full'
        >
          {isPending ? '保存中...' : '完成！'}
        </Button>
      </div>
    );
  }

  // ステップ6: 完成
  if (step === 'completed') {
    return (
      <div className='max-w-2xl mx-auto p-6 space-y-6 text-center'>
        <div className='space-y-4'>
          <div className='text-6xl'>🎉</div>
          <h2 className='text-3xl font-bold'>記事が完成しました！</h2>
          <p className='text-gray-600'>記事ID: {draftId}</p>
        </div>

        <Button
          onClick={() => {
            setStep('start');
            setTheme('');
            setDraftId(null);
            setStrategy(null);
            setSections([]);
            setCurrentSectionIndex(0);
            setFeedback('');
            setError(null);
          }}
          className='w-full'
        >
          新しい記事を執筆
        </Button>
      </div>
    );
  }

  return null;
}
