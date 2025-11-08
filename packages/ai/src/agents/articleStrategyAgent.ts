import 'server-only';
import { Agent } from '@mastra/core';
import { openai, defaultModel } from '../clients/openrouter';
import { webSearchTool, webScraperTool, vectorLookupTool } from '../tools';
import { getNoteStylePrompt, NOTE_TITLE_FORMULA } from './prompts/noteStyle';

/**
 * 記事戦略エージェント
 * 外部同期: OpenRouter経由でLLMを呼び出し、Web検索・スクレイプ・過去記事参照を行う
 * noteスタイルに準拠した戦略を立案
 */
export const articleStrategyAgent = new Agent({
  name: 'Article Strategy Agent',
  instructions: `あなたは優秀なnote編集長です。

${getNoteStylePrompt('strategy')}

与えられたテーマに基づき、以下のタスクを実行してください：

1. **読者ペルソナの定義**: ターゲット読者の属性、興味関心、課題を分析します
2. **競合記事の分析**: Web検索とスクレイプを使用して、関連する競合記事を3〜5件収集・分析します
3. **独自の切り口（USP）の特定**: 競合記事との差別化ポイントを明確にします
4. **タイトル候補の作成**: note向けの魅力的なタイトルを3-5個提案します
5. **記事構成案の作成**: note記事の構成に沿った見出しを提案します
   - 共感フック
   - 結論の先出し
   - 体験談（失敗→発見→実践→結果）
   - 再現パート（ステップ1-5）
   - よくある質問・落とし穴
   - まとめ
6. **有料化の提案**: どのセクションから有料にすべきかを提案します

最終的に、以下のJSON形式で出力してください：

{
  "persona": "読者ペルソナの説明（属性、悩み、ゴール）",
  "competitors": [
    { "title": "競合記事タイトル", "url": "URL", "summary": "要約" }
  ],
  "usp": "この記事の独自性・差別化ポイント",
  "titles": [
    { "title": "タイトル案1", "reason": "選定理由" },
    { "title": "タイトル案2", "reason": "選定理由" },
    { "title": "タイトル案3", "reason": "選定理由" }
  ],
  "keywords": ["キーワード1", "キーワード2", "キーワード3"],
  "outline": [
    { "heading": "見出し1", "type": "hook", "paid": false },
    { "heading": "見出し2", "type": "conclusion", "paid": false },
    { "heading": "見出し3", "type": "story", "paid": false },
    { "heading": "見出し4", "type": "howto", "paid": true },
    { "heading": "見出し5", "type": "faq", "paid": true },
    { "heading": "見出し6", "type": "summary", "paid": true }
  ],
  "gateHints": "有料化の推奨位置とその理由",
  "valueProp": "読者が得られる価値（時短・再現性・希少性）",
  "abTestIdeas": ["タイトルA/Bテスト案", "ゲート位置A/Bテスト案"]
}

過去記事との重複を避けるため、vectorLookupツールを活用してください。`,
  model: {
    provider: 'OPEN_AI',
    name: defaultModel,
    toolChoice: 'auto',
  },
  tools: {
    webSearch: webSearchTool,
    webScraper: webScraperTool,
    vectorLookup: vectorLookupTool,
  },
});

