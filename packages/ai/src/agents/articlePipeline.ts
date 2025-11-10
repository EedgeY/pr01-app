import 'server-only';
import { openai, defaultModel, withRetry } from '../clients/openrouter';
import {
  articleStrategyAgent,
  articleDraftAgent,
  gateAndPricingAgent,
  ctaAgent,
  distributionAgent,
  editorAgent,
  titleScorerAgent,
  scoreTitle,
  expertArticleStrategyAgent,
  expertArticleDraftAgent,
  expertEditorAgent,
  scoreExpertTitle,
} from './index';

/**
 * 記事生成オプション
 */
export interface GenerateNoteArticleOptions {
  includeDistribution?: boolean; // X投稿文を生成するか
  includeAssets?: boolean; // 付録素材を生成するか
  strictFormatting?: boolean; // 厳密なフォーマットチェックを行うか
  priceTier?: 'low' | 'standard' | 'premium'; // 価格帯
  toneLevel?: 'casual' | 'standard' | 'formal'; // 口調レベル
  profileUrl?: string; // noteプロフィールURL
  magazineUrl?: string; // マガジンURL
  writingStyle?: 'note' | 'expert'; // 文体スタイル（既定: expert）
  ctaMode?: 'full' | 'minimal'; // CTAモード（既定: minimal）
}

/**
 * 記事生成結果
 */
export interface NoteArticleResult {
  // メタデータ
  meta: {
    theme: string;
    selectedTitle: string;
    price: number;
    paywallIndex: number;
    wordCount: {
      total: number;
      free: number;
      paid: number;
    };
    metrics: {
      questionCount: number;
      sectionCount: number;
      checklistItems: number;
    };
  };

  // 戦略
  strategy: {
    persona: string;
    usp: string;
    titles: Array<{ title: string; score: number; reason: string }>;
    keywords: string[];
    outline: Array<{ heading: string; type: string; paid: boolean }>;
    gateHints: string;
    valueProp: string;
  };

  // 本文
  content: {
    combinedMarkdown: string; // [PAYWALL]マーカー入り
    freeMarkdown: string; // 無料部分のみ
    paidMarkdown: string; // 有料部分のみ
  };

  // CTA
  cta: {
    header: string; // 冒頭フォロー誘導
    freeFooter: string; // 無料記事末尾
    paidBridge: string; // 有料ブリッジ
    paidFooter: string; // 有料記事末尾
  };

  // 配信（オプション）
  distribution?: {
    posts: Array<{
      timing: string;
      pattern: string;
      text: string;
      imageText: string;
    }>;
    thread: string[];
    hashtags: string[];
  };

  // 品質チェック
  qualityCheck: {
    overallScore: number;
    checklist: any;
    patches: any[];
    strengths: string[];
    recommendations: string[];
  };
}

/**
 * note記事を全自動で生成
 */
export async function generateNoteArticle(
  theme: string,
  options: GenerateNoteArticleOptions = {}
): Promise<NoteArticleResult> {
  const {
    includeDistribution = false,
    includeAssets = false,
    strictFormatting = true,
    priceTier = 'standard',
    toneLevel = 'standard',
    profileUrl = '',
    magazineUrl = '',
    writingStyle = 'expert', // 既定は専門スタイル
    ctaMode = 'minimal', // 既定は最小化
  } = options;

  // スタイルに応じてエージェントを選択
  const strategyAgent = writingStyle === 'expert' ? expertArticleStrategyAgent : articleStrategyAgent;
  const draftAgent = writingStyle === 'expert' ? expertArticleDraftAgent : articleDraftAgent;
  const editorAgentSelected = writingStyle === 'expert' ? expertEditorAgent : editorAgent;
  const scoreTitleFunc = writingStyle === 'expert' ? scoreExpertTitle : scoreTitle;

  console.log('[Pipeline] Step 1: Strategy generation...');

  // Step 1: 戦略生成
  const strategyPrompt = `記事テーマ: ${theme}

このテーマについて、noteスタイルに沿った記事戦略を立案してください。
JSON形式で出力してください。`;

  const strategyResult = await withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: defaultModel,
      messages: [
        {
          role: 'system',
          content: strategyAgent.instructions,
        },
        {
          role: 'user',
          content: strategyPrompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No strategy response');
    return JSON.parse(content);
  });

  console.log('[Pipeline] Step 2: Title scoring...');

  // Step 2: タイトルスコアリング
  const titleScores = strategyResult.titles.map((t: any) => {
    const scoreResult = scoreTitleFunc(t.title);
    return {
      title: t.title,
      score: scoreResult.score,
      breakdown: scoreResult.breakdown,
      reason: t.reason,
      feedback: scoreResult.feedback,
    };
  });

  // 最高得点のタイトルを選択
  const selectedTitle = titleScores.reduce((best: any, current: any) =>
    current.score > best.score ? current : best
  );

  console.log('[Pipeline] Step 3: Draft generation...');

  // Step 3: 各セクションのドラフト生成
  const sections = [];
  let previousContext = '';

  for (let i = 0; i < strategyResult.outline.length; i++) {
    const section = strategyResult.outline[i];

    const draftPrompt = JSON.stringify({
      persona: strategyResult.persona,
      usp: strategyResult.usp,
      heading: section.heading,
      type: section.type,
      context: previousContext,
    });

    const sectionBody = await withRetry(async () => {
      const response = await openai.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: 'system',
            content: draftAgent.instructions,
          },
          {
            role: 'user',
            content: draftPrompt,
          },
        ],
      });

      return response.choices[0]?.message?.content || '';
    });

    sections.push({
      heading: section.heading,
      type: section.type,
      paid: section.paid,
      body: sectionBody,
      wordCount: sectionBody.length,
    });

    // コンテキストを更新（最後の2セクションのみ保持）
    previousContext = sections
      .slice(-2)
      .map((s) => `## ${s.heading}\n${s.body}`)
      .join('\n\n');
  }

  console.log('[Pipeline] Step 4: Gate & pricing...');

  // Step 4: ゲート&価格設定
  const gatePrompt = JSON.stringify({
    sections: sections.map((s) => ({
      heading: s.heading,
      type: s.type,
      wordCount: s.wordCount,
      body: s.body.substring(0, 200) + '...', // 要約のみ送信
    })),
    assets: includeAssets
      ? ['テンプレート', 'チェックリスト', 'スプレッドシート']
      : [],
    valueProp: strategyResult.valueProp,
  });

  const gateResult = await withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: defaultModel,
      messages: [
        {
          role: 'system',
          content: gateAndPricingAgent.instructions,
        },
        {
          role: 'user',
          content: gatePrompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No gate response');
    return JSON.parse(content);
  });

  // 価格帯による調整
  let finalPrice = gateResult.pricing.amount;
  if (priceTier === 'low') finalPrice = Math.floor(finalPrice * 0.8);
  if (priceTier === 'premium') finalPrice = Math.floor(finalPrice * 1.2);

  console.log('[Pipeline] Step 5: CTA generation...');

  // Step 5: CTA生成
  let ctas: any = {};
  
  if (ctaMode === 'minimal') {
    // 最小化モード: 固定値で上書き
    ctas = {
      header: `[フォローはこちら](${profileUrl || 'https://note.com/your_profile'})`,
      freefooter: '',
      paidbridge: '---\n\nここから先は有料です\n\n---',
      paidfooter: '',
    };
  } else {
    // フルモード: 従来通りCTAを生成
    const ctaPrompts = [
      { type: 'header', variation: 'standard' },
      { type: 'free_footer', variation: 'standard' },
      { type: 'paid_bridge', variation: 'standard' },
      { type: 'paid_footer', variation: 'standard' },
    ];

    for (const ctaPrompt of ctaPrompts) {
      const prompt = JSON.stringify({
        ctaType: ctaPrompt.type,
        articleTheme: theme,
        paidContentSummary: gateResult.paidContentSummary,
        price: finalPrice,
        relatedArticles: [],
        profileUrl,
        magazineUrl,
        variation: ctaPrompt.variation,
      });

      const ctaText = await withRetry(async () => {
        const response = await openai.chat.completions.create({
          model: defaultModel,
          messages: [
            {
              role: 'system',
              content: ctaAgent.instructions,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        return response.choices[0]?.message?.content || '';
      });

      const key = ctaPrompt.type.replace('_', '').replace('_', '');
      ctas[key] = ctaText;
    }
  }

  console.log('[Pipeline] Step 6: Editor QA...');

  // Step 6: 編集チェック
  const editorPrompt = JSON.stringify({
    title: selectedTitle.title,
    sections: sections.map((s) => ({
      heading: s.heading,
      body: s.body,
    })),
  });

  const editorResult = await withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: defaultModel,
      messages: [
        {
          role: 'system',
          content: editorAgentSelected.instructions,
        },
        {
          role: 'user',
          content: editorPrompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No editor response');
    return JSON.parse(content);
  });

  // 修正パッチを適用（高優先度のみ）
  if (strictFormatting) {
    const highPriorityPatches = editorResult.patches.filter(
      (p: any) => p.severity === 'high'
    );
    // TODO: パッチ適用ロジック（簡易版は省略）
  }

  console.log('[Pipeline] Step 7: Post-processing...');

  // Step 7: ポストプロセス（Markdown整形）
  const paywallIndex = gateResult.gatePosition.sectionIndex;

  // combined.md（[PAYWALL]マーカー入り）
  let combinedMarkdown = `# ${selectedTitle.title}\n\n`;
  combinedMarkdown += ctas.header + '\n\n';

  sections.forEach((section, index) => {
    if (index === paywallIndex) {
      combinedMarkdown += ctas.paidbridge + '\n\n';
    }
    combinedMarkdown += `## ${section.heading}\n\n${section.body}\n\n`;
  });

  combinedMarkdown += ctas.paidfooter;

  // free.md
  let freeMarkdown = `# ${selectedTitle.title}\n\n`;
  freeMarkdown += ctas.header + '\n\n';
  sections.slice(0, paywallIndex).forEach((section) => {
    freeMarkdown += `## ${section.heading}\n\n${section.body}\n\n`;
  });
  freeMarkdown += ctas.freefooter;

  // paid.md
  let paidMarkdown = '';
  sections.slice(paywallIndex).forEach((section) => {
    paidMarkdown += `## ${section.heading}\n\n${section.body}\n\n`;
  });
  paidMarkdown += ctas.paidfooter;

  console.log('[Pipeline] Step 8: Distribution (optional)...');

  // Step 8: 配信生成（オプション）
  let distribution;
  if (includeDistribution) {
    const distPrompt = JSON.stringify({
      title: selectedTitle.title,
      summary: strategyResult.usp,
      keyPoints: sections.slice(0, 3).map((s: any) => s.heading),
      targetAudience: strategyResult.persona,
      articleUrl: '', // 後で設定
      hashtags: strategyResult.keywords.slice(0, 3),
    });

    distribution = await withRetry(async () => {
      const response = await openai.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: 'system',
            content: distributionAgent.instructions,
          },
          {
            role: 'user',
            content: distPrompt,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No distribution response');
      return JSON.parse(content);
    });
  }

  console.log('[Pipeline] Step 9: Metadata calculation...');

  // Step 9: メタデータ計算
  const totalWordCount = sections.reduce((sum, s) => sum + s.wordCount, 0);
  const freeWordCount = sections
    .slice(0, paywallIndex)
    .reduce((sum, s) => sum + s.wordCount, 0);
  const paidWordCount = totalWordCount - freeWordCount;

  const questionCount = combinedMarkdown.match(/[？?]/g)?.length || 0;
  const checklistItems = combinedMarkdown.match(/- \[ \]/g)?.length || 0;

  console.log('[Pipeline] Complete!');

  return {
    meta: {
      theme,
      selectedTitle: selectedTitle.title,
      price: finalPrice,
      paywallIndex,
      wordCount: {
        total: totalWordCount,
        free: freeWordCount,
        paid: paidWordCount,
      },
      metrics: {
        questionCount,
        sectionCount: sections.length,
        checklistItems,
      },
    },
    strategy: {
      persona: strategyResult.persona,
      usp: strategyResult.usp,
      titles: titleScores,
      keywords: strategyResult.keywords,
      outline: strategyResult.outline,
      gateHints: strategyResult.gateHints,
      valueProp: strategyResult.valueProp,
    },
    content: {
      combinedMarkdown,
      freeMarkdown,
      paidMarkdown,
    },
    cta: {
      header: ctas.header,
      freeFooter: ctas.freefooter,
      paidBridge: ctas.paidbridge,
      paidFooter: ctas.paidfooter,
    },
    distribution,
    qualityCheck: editorResult,
  };
}
