import 'server-only';
import { Agent } from '@mastra/core';
import { openai, defaultModel } from '../clients/openrouter';
import { webSearchTool, webScraperTool, vectorLookupTool } from '../tools';

/**
 * 記事戦略エージェント
 * 外部同期: OpenRouter経由でLLMを呼び出し、Web検索・スクレイプ・過去記事参照を行う
 */
export const articleStrategyAgent = new Agent({
  name: 'Article Strategy Agent',
  instructions: `あなたは優秀なWebメディア編集長です。

与えられたテーマに基づき、以下のタスクを実行してください：

1. **読者ペルソナの定義**: ターゲット読者の属性、興味関心、課題を分析します
2. **競合記事の分析**: Web検索とスクレイプを使用して、関連する競合記事を3〜5件収集・分析します
3. **独自の切り口（USP）の特定**: 競合記事との差別化ポイントを明確にします
4. **記事構成案の作成**: 最適な見出し構成（3〜7セクション）を提案します

最終的に、以下のJSON形式で出力してください：

{
  "persona": "読者ペルソナの説明",
  "competitors": [
    { "title": "競合記事タイトル", "url": "URL", "summary": "要約" }
  ],
  "usp": "この記事の独自性・差別化ポイント",
  "outline": ["見出し1", "見出し2", "見出し3", ...]
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

