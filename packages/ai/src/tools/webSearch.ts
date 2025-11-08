import 'server-only';
import { createTool } from '@mastra/core';
import { z } from 'zod';

/**
 * Web検索ツール
 * 外部同期: Google検索API（またはSerpAPI等）を呼び出す
 */
export const webSearchTool = createTool({
  id: 'web-search',
  description:
    'Search the web for articles, blog posts, and information related to a given query. Returns a list of URLs and titles.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    maxResults: z.number().optional().default(5).describe('Maximum number of results to return'),
  }),
  execute: async ({ context }) => {
    const { query, maxResults } = context;

    // TODO: 実際のWeb検索APIを統合（Google Custom Search API、SerpAPI等）
    // 現在は仮のモックデータを返す
    console.log(`[webSearchTool] Searching for: ${query}`);

    // モック: 実際の実装では外部APIを呼び出す
    const mockResults = [
      {
        title: `${query} - Complete Guide`,
        url: `https://example.com/${encodeURIComponent(query)}-guide`,
        snippet: `A comprehensive guide about ${query}...`,
      },
      {
        title: `Best Practices for ${query}`,
        url: `https://example.com/${encodeURIComponent(query)}-best-practices`,
        snippet: `Learn the best practices for ${query}...`,
      },
      {
        title: `${query} Tutorial`,
        url: `https://example.com/${encodeURIComponent(query)}-tutorial`,
        snippet: `Step-by-step tutorial for ${query}...`,
      },
    ].slice(0, maxResults);

    return {
      results: mockResults,
      query,
      count: mockResults.length,
    };
  },
});

