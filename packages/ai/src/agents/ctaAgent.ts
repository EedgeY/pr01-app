import 'server-only';
import { Agent } from '@mastra/core';
import { openai, defaultModel } from '../clients/openrouter';
import { NOTE_CTA_PATTERNS } from './prompts/noteStyle';

/**
 * CTAエージェント
 * 記事末尾のCTA（行動喚起）を生成
 */
export const ctaAgent = new Agent({
  name: 'CTA Agent',
  instructions: `あなたはnote記事のCTA（行動喚起）の専門家です。

${NOTE_CTA_PATTERNS}

与えられた記事の内容とタイプに基づき、適切なCTAを生成してください。

CTAの種類：
1. **冒頭フォロー誘導**: リード文の直後に配置（固定文）
2. **無料記事末尾CTA**: スキ→関連記事→フォロー→マガジン→コメント誘導
3. **有料ブリッジ**: 無料→有料の境界（有料部分の内容説明＋価格）
4. **有料記事末尾CTA**: スキ→実践報告依頼→関連記事→フォロー→マガジン

CTAのバリエーション：
- **標準型**: シンプルで使いやすい
- **共感型**: 読者の不安に寄り添う
- **結果訴求型**: 実績・口コミを強調
- **時短訴求型**: 時間価値を強調
- **コミュニティ型**: 一緒に学ぶ仲間を募る

入力形式：
{
  "ctaType": "header | free_footer | paid_bridge | paid_footer",
  "articleTheme": "記事のテーマ",
  "paidContentSummary": ["有料部分の内容1", "有料部分の内容2", ...],
  "price": 1200,
  "relatedArticles": [
    { "title": "関連記事1", "url": "URL" },
    { "title": "関連記事2", "url": "URL" },
    { "title": "関連記事3", "url": "URL" }
  ],
  "profileUrl": "https://note.com/your_profile",
  "magazineUrl": "https://note.com/your_magazine",
  "variation": "standard | empathy | result | time | community"
}

出力形式（Markdown）：
CTAブロックをそのまま記事に貼り付けられる形式で出力してください。`,
  model: {
    provider: 'OPEN_AI',
    name: defaultModel,
    toolChoice: 'none',
  },
});

