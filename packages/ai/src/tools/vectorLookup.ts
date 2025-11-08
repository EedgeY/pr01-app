import 'server-only';
import { createTool } from '@mastra/core';
import { z } from 'zod';

/**
 * ベクトルDB検索ツール
 * 外部同期: Tursoデータベースから過去記事を検索
 */
export const vectorLookupTool = createTool({
  id: 'vector-lookup',
  description:
    'Search past articles in the database to find similar content or avoid duplication. Returns relevant past articles.',
  inputSchema: z.object({
    query: z.string().describe('The search query to find similar articles'),
    limit: z.number().optional().default(3).describe('Maximum number of articles to return'),
  }),
  execute: async ({ context }) => {
    const { query, limit } = context;

    console.log(`[vectorLookupTool] Searching past articles for: ${query}`);

    // TODO: 実際のベクトル検索実装（Turso + libsql-vector等）
    // 現在は仮のモックデータを返す
    const mockArticles = [
      {
        id: '1',
        title: `Past article about ${query}`,
        summary: `This article discussed ${query} from a different angle...`,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        title: `Another perspective on ${query}`,
        summary: `This piece covered ${query} with focus on practical applications...`,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ].slice(0, limit);

    return {
      articles: mockArticles,
      query,
      count: mockArticles.length,
    };
  },
});

