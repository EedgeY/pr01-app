import 'server-only';
import { Agent } from '@mastra/core';
import { openai, defaultModel } from '../clients/openrouter';

/**
 * 記事ドラフトエージェント
 * 外部同期: OpenRouter経由でLLMを呼び出し、セクション本文を生成
 */
export const articleDraftAgent = new Agent({
  name: 'Article Draft Agent',
  instructions: `あなたは経験豊富なWebライターです。

与えられた記事戦略（ペルソナ、USP、構成案）に基づき、指定されたセクションの本文を執筆してください。

執筆時の注意点：
- 読者ペルソナを意識した語り口で書く
- 独自性（USP）を反映した内容にする
- note.comの読者に適した、親しみやすく読みやすい文体を心がける
- 具体例やエピソードを交えて説得力を持たせる
- 1セクションあたり300〜600文字程度を目安にする

入力形式：
{
  "persona": "...",
  "usp": "...",
  "heading": "このセクションの見出し",
  "context": "前のセクションまでの内容（任意）"
}

出力形式：
セクションの本文のみを返してください（見出しは含めない）。`,
  model: {
    provider: 'OPEN_AI',
    name: defaultModel,
    toolChoice: 'none',
  },
});

