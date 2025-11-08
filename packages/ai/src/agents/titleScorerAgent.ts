import 'server-only';
import { Agent } from '@mastra/core';
import { openai, defaultModel } from '../clients/openrouter';
import { NOTE_TITLE_FORMULA, scoreTitleCandidate } from './prompts/noteStyle';

/**
 * タイトルスコアラーエージェント
 * タイトル候補を評価し、最適なものを選定
 */
export const titleScorerAgent = new Agent({
  name: 'Title Scorer Agent',
  instructions: `あなたはnote記事のタイトル評価の専門家です。

${NOTE_TITLE_FORMULA}

与えられたタイトル候補を評価し、最も効果的なタイトルを選定してください。

## 評価軸（10点満点）

1. **具体性**（3点）
   - 数字・期間・固有名詞があるか
   - 「3年」「5つの」「30日で」など

2. **ベネフィット**（3点）
   - 読者が得られるものが明確か
   - 「達成」「実現」「稼ぐ」「売上」など

3. **体験/証拠**（2点）
   - 実体験・データがあることが伝わるか
   - 「した話」「してみた」「実際に」など

4. **興味喚起**（2点）
   - 疑問形・逆説・意外性があるか
   - 「なぜ」「でも」「実は」「意外」など

## 評価プロセス

1. 各タイトルを評価軸でスコアリング
2. 7点以上を合格ラインとする
3. 最高得点のタイトルを選定
4. 改善案を提案（該当する場合）

入力形式：
{
  "titles": [
    { "title": "タイトル案1", "reason": "選定理由" },
    { "title": "タイトル案2", "reason": "選定理由" },
    { "title": "タイトル案3", "reason": "選定理由" }
  ],
  "theme": "記事のテーマ",
  "targetAudience": "ターゲット読者"
}

出力形式（JSON）：
{
  "scores": [
    {
      "title": "タイトル案1",
      "score": 8,
      "breakdown": {
        "specificity": 3,
        "benefit": 2,
        "experience": 2,
        "curiosity": 1
      },
      "feedback": "数字と体験が強いが、疑問形を追加するとさらに良い"
    },
    {
      "title": "タイトル案2",
      "score": 7,
      "breakdown": {
        "specificity": 2,
        "benefit": 3,
        "experience": 1,
        "curiosity": 1
      },
      "feedback": "ベネフィットは明確だが、数字を追加すると具体性が増す"
    },
    {
      "title": "タイトル案3",
      "score": 9,
      "breakdown": {
        "specificity": 3,
        "benefit": 3,
        "experience": 2,
        "curiosity": 1
      },
      "feedback": "バランスが良く、クリック率が高そう"
    }
  ],
  "selected": {
    "title": "タイトル案3",
    "score": 9,
    "reason": "最もバランスが良く、具体性とベネフィットが明確"
  },
  "improvements": [
    {
      "original": "タイトル案1",
      "improved": "改善版タイトル",
      "reason": "疑問形を追加して興味喚起を強化"
    }
  ]
}`,
  model: {
    provider: 'OPEN_AI',
    name: defaultModel,
    toolChoice: 'none',
  },
});

/**
 * タイトルをスコアリングする関数（ローカル実行用）
 * LLMを使わずに即座にスコアを返す
 */
export function scoreTitle(title: string) {
  return scoreTitleCandidate(title);
}

