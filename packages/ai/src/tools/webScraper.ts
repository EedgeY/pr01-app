import 'server-only';
import { createTool } from '@mastra/core';
import { z } from 'zod';

/**
 * Webスクレイパーツール
 * 外部同期: 指定URLからコンテンツを取得
 */
export const webScraperTool = createTool({
  id: 'web-scraper',
  description:
    'Fetch and extract the main content from a given URL. Returns the text content of the page.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to scrape'),
  }),
  execute: async ({ context }) => {
    const { url } = context;

    console.log(`[webScraperTool] Scraping: ${url}`);

    try {
      // TODO: 実際のスクレイピング実装（Cheerio、Puppeteer等）
      // 現在は仮のモックデータを返す
      const mockContent = `
# Article Title from ${url}

This is the main content extracted from the URL.
It contains information about the topic discussed in the article.

## Key Points
- Point 1: Important information
- Point 2: More details
- Point 3: Additional context

The article provides comprehensive coverage of the subject matter.
      `.trim();

      return {
        url,
        content: mockContent,
        success: true,
      };
    } catch (error: any) {
      return {
        url,
        content: '',
        success: false,
        error: error.message,
      };
    }
  },
});

