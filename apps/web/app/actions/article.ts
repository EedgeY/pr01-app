'use server';

import { db } from '@workspace/db/client';
import { articles } from '@workspace/db/schema';
import { eq } from '@workspace/db';
import { articleStrategyAgent, articleDraftAgent, openai, defaultModel, withRetry } from '@workspace/ai';
import { auth } from '@workspace/auth';
import { headers } from 'next/headers';
import { nanoid } from 'nanoid';

/**
 * 現在のセッションを取得するヘルパー
 */
async function getSession() {
  return await auth.api.getSession({
    headers: await headers(),
  });
}

/**
 * 記事戦略を計画するServer Action
 * 外部同期: OpenRouter経由でLLMを呼び出し、戦略を生成
 */
export async function planArticleStrategy(theme: string) {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    // 戦略生成（Mastraエージェントを使用）
    // TODO: 実際のMastra Agent APIに合わせて調整
    const strategyPrompt = `記事テーマ: ${theme}

このテーマについて、以下の形式でJSON出力してください：
{
  "persona": "読者ペルソナの説明（属性、興味、課題）",
  "competitors": [
    { "title": "競合記事タイトル", "url": "URL", "summary": "要約" }
  ],
  "usp": "この記事の独自性・差別化ポイント",
  "outline": ["見出し1", "見出し2", "見出し3"]
}`;

    const strategyResult = await withRetry(async () => {
      const response = await openai.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: 'system',
            content: articleStrategyAgent.instructions,
          },
          {
            role: 'user',
            content: strategyPrompt,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      return JSON.parse(content);
    });

    // DBに保存
    const [draft] = await db
      .insert(articles)
      .values({
        id: nanoid(),
        authorId: userId || null,
        title: theme,
        status: 'planning',
        strategyMemo: strategyResult,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .returning();

    return {
      success: true,
      draftId: draft.id,
      strategy: strategyResult,
    };
  } catch (error: any) {
    console.error('[planArticleStrategy] Error:', error);
    return {
      success: false,
      error: error.message || '戦略の策定に失敗しました',
    };
  }
}

/**
 * 構成案を修正するServer Action
 */
export async function refineOutline(draftId: string, feedback: string) {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    // 記事を取得
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, draftId))
      .limit(1);

    if (!article) {
      return { success: false, error: '記事が見つかりません' };
    }

    // 権限チェック
    if (article.authorId && article.authorId !== userId) {
      return { success: false, error: '権限がありません' };
    }

    const currentStrategy = article.strategyMemo as any;

    // フィードバックを反映して構成案を修正
    const refinePrompt = `現在の記事戦略:
${JSON.stringify(currentStrategy, null, 2)}

ユーザーからのフィードバック:
${feedback}

フィードバックを反映して、記事戦略を修正してください。JSON形式で出力してください。`;

    const refinedStrategy = await withRetry(async () => {
      const response = await openai.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: 'system',
            content: articleStrategyAgent.instructions,
          },
          {
            role: 'user',
            content: refinePrompt,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      return JSON.parse(content);
    });

    // DBを更新
    await db
      .update(articles)
      .set({
        strategyMemo: refinedStrategy,
        updatedAt: Date.now(),
      })
      .where(eq(articles.id, draftId));

    return {
      success: true,
      strategy: refinedStrategy,
    };
  } catch (error: any) {
    console.error('[refineOutline] Error:', error);
    return {
      success: false,
      error: error.message || '構成案の修正に失敗しました',
    };
  }
}

/**
 * セクション本文を生成するServer Action
 */
export async function generateSection(
  draftId: string,
  sectionIndex: number,
  customPrompt?: string
) {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    // 記事を取得
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, draftId))
      .limit(1);

    if (!article) {
      return { success: false, error: '記事が見つかりません' };
    }

    // 権限チェック
    if (article.authorId && article.authorId !== userId) {
      return { success: false, error: '権限がありません' };
    }

    const strategy = article.strategyMemo as any;
    const currentSections = (article.sections as any) || [];
    const heading = strategy.outline?.[sectionIndex];

    if (!heading) {
      return { success: false, error: '見出しが見つかりません' };
    }

    // 前のセクションの内容をコンテキストとして取得
    const previousContext = currentSections
      .slice(0, sectionIndex)
      .map((s: any) => `## ${s.heading}\n${s.body}`)
      .join('\n\n');

    const generatePrompt = `記事戦略:
- ペルソナ: ${strategy.persona}
- USP: ${strategy.usp}

これまでのセクション:
${previousContext || '（まだありません）'}

次のセクションの見出し: ${heading}

${customPrompt ? `追加の指示: ${customPrompt}` : ''}

このセクションの本文を執筆してください（見出しは含めず、本文のみ）。`;

    const sectionBody = await withRetry(async () => {
      const response = await openai.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: 'system',
            content: articleDraftAgent.instructions,
          },
          {
            role: 'user',
            content: generatePrompt,
          },
        ],
      });

      return response.choices[0]?.message?.content || '';
    });

    // セクションを追加/更新
    const newSections = [...currentSections];
    newSections[sectionIndex] = { heading, body: sectionBody };

    await db
      .update(articles)
      .set({
        sections: newSections,
        status: 'draft',
        updatedAt: Date.now(),
      })
      .where(eq(articles.id, draftId));

    return {
      success: true,
      section: { heading, body: sectionBody },
      sectionIndex,
    };
  } catch (error: any) {
    console.error('[generateSection] Error:', error);
    return {
      success: false,
      error: error.message || 'セクションの生成に失敗しました',
    };
  }
}

/**
 * 記事を完成させるServer Action
 */
export async function finalizeArticle(draftId: string) {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    // 記事を取得
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, draftId))
      .limit(1);

    if (!article) {
      return { success: false, error: '記事が見つかりません' };
    }

    // 権限チェック
    if (article.authorId && article.authorId !== userId) {
      return { success: false, error: '権限がありません' };
    }

    // ステータスを更新
    await db
      .update(articles)
      .set({
        status: 'published',
        updatedAt: Date.now(),
      })
      .where(eq(articles.id, draftId));

    return {
      success: true,
      articleId: draftId,
    };
  } catch (error: any) {
    console.error('[finalizeArticle] Error:', error);
    return {
      success: false,
      error: error.message || '記事の完成に失敗しました',
    };
  }
}

/**
 * ワークフロー状態を保存するServer Action
 */
export async function saveWorkflowState(draftId: string, state: any) {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    // 記事を取得
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, draftId))
      .limit(1);

    if (!article) {
      return { success: false, error: '記事が見つかりません' };
    }

    // 権限チェック
    if (article.authorId && article.authorId !== userId) {
      return { success: false, error: '権限がありません' };
    }

    await db
      .update(articles)
      .set({
        workflowState: state,
        updatedAt: Date.now(),
      })
      .where(eq(articles.id, draftId));

    return { success: true };
  } catch (error: any) {
    console.error('[saveWorkflowState] Error:', error);
    return {
      success: false,
      error: error.message || '状態の保存に失敗しました',
    };
  }
}

/**
 * ワークフロー状態を読み込むServer Action
 */
export async function loadWorkflowState(draftId: string) {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    // 記事を取得
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, draftId))
      .limit(1);

    if (!article) {
      return { success: false, error: '記事が見つかりません' };
    }

    // 権限チェック（未ログインでも閲覧可能、保存時にログイン要求）
    if (article.authorId && article.authorId !== userId) {
      return { success: false, error: '権限がありません' };
    }

    return {
      success: true,
      state: article.workflowState,
      article: {
        id: article.id,
        title: article.title,
        status: article.status,
        strategyMemo: article.strategyMemo,
        sections: article.sections,
      },
    };
  } catch (error: any) {
    console.error('[loadWorkflowState] Error:', error);
    return {
      success: false,
      error: error.message || '状態の読み込みに失敗しました',
    };
  }
}

/**
 * ユーザーの記事一覧を取得するServer Action
 */
export async function listUserArticles() {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    if (!userId) {
      return { success: false, error: 'ログインが必要です' };
    }

    const userArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        status: articles.status,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(eq(articles.authorId, userId))
      .orderBy(articles.updatedAt);

    return {
      success: true,
      articles: userArticles,
    };
  } catch (error: any) {
    console.error('[listUserArticles] Error:', error);
    return {
      success: false,
      error: error.message || '記事一覧の取得に失敗しました',
    };
  }
}

